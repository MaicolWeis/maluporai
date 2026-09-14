import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenant-context.js';

const app = createApp();

function signupPayload(suffix: string) {
  return {
    nomeFantasia: `Empresa Teste ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-${suffix}@teste-auth.com`,
    senha: `SenhaForte-${suffix}-9x`,
  };
}

function extractCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0];
}

// tenants criados pelos testes, para limpeza no afterAll (app_user não tem
// DELETE em tenants por desenho — cf. P1 — então só marcamos como cancelado,
// via a role de admin, para não sujar o banco de teste entre execuções).
const createdTenantIds: string[] = [];

afterAll(async () => {
  // adminClient (role de admin, superuser) bypassa RLS: não precisa de
  // runWithTenant nem passa pela extensão de tenant, só para limpeza.
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.refreshToken.deleteMany({ where: { tenantId } });
    await adminClient.passwordResetToken.deleteMany({ where: { tenantId } });
    await adminClient.auditLog.deleteMany({ where: { tenantId } });
    await adminClient.user.deleteMany({ where: { tenantId } });
    await adminClient.tenantSettings.deleteMany({ where: { tenantId } });
    await adminClient.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
  await adminClient.$disconnect();
  await prisma.$disconnect();
});

describe('POST /auth/signup', () => {
  it('cria tenant + admin isolado (reaproveita o isolamento do P1)', async () => {
    const suffixA = randomUUID().slice(0, 8);
    const suffixB = randomUUID().slice(0, 8);

    const resA = await request(app).post('/auth/signup').send(signupPayload(suffixA));
    const resB = await request(app).post('/auth/signup').send(signupPayload(suffixB));

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.accessToken).toBeTruthy();
    expect(resA.body.user.tenant.id).not.toBe(resB.body.user.tenant.id);

    createdTenantIds.push(resA.body.user.tenant.id, resB.body.user.tenant.id);

    // Tokens nunca em localStorage é responsabilidade do front; aqui
    // garantimos que o refresh token só existe como cookie httpOnly.
    const setCookie = resA.headers['set-cookie'];
    const cookies: string[] = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c) => c.startsWith('refresh_token=') && /httponly/i.test(c))).toBe(true);
    expect(resA.body.refreshToken).toBeUndefined();

    // Isolamento: usuário do tenant A não aparece numa query rodada no
    // contexto do tenant B, e vice-versa (mesma garantia testada no P1).
    const usersInTenantA = await runWithTenant(resA.body.user.tenant.id, () => prisma.user.findMany());
    expect(usersInTenantA.some((u) => u.id === resA.body.user.id)).toBe(true);
    expect(usersInTenantA.some((u) => u.id === resB.body.user.id)).toBe(false);
  });

  it('recusa e-mail já cadastrado', async () => {
    const suffix = randomUUID().slice(0, 8);
    const payload = signupPayload(suffix);
    const first = await request(app).post('/auth/signup').send(payload);
    createdTenantIds.push(first.body.user.tenant.id);

    const second = await request(app)
      .post('/auth/signup')
      .send({ ...payload, nomeFantasia: 'Outra Empresa' });

    expect(second.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('responde a mesma mensagem genérica para senha errada e e-mail inexistente', async () => {
    const suffix = randomUUID().slice(0, 8);
    const payload = signupPayload(suffix);
    const signupRes = await request(app).post('/auth/signup').send(payload);
    createdTenantIds.push(signupRes.body.user.tenant.id);

    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: payload.email, senha: 'SenhaErrada999' });
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: `nao-existe-${suffix}@teste-auth.com`, senha: 'QualquerSenha1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.message.toLowerCase()).not.toContain('não encontrado');
  });

  it('faz login com credenciais corretas e devolve accessToken + cookie de refresh', async () => {
    const suffix = randomUUID().slice(0, 8);
    const payload = signupPayload(suffix);
    const signupRes = await request(app).post('/auth/signup').send(payload);
    createdTenantIds.push(signupRes.body.user.tenant.id);

    const loginRes = await request(app).post('/auth/login').send({ email: payload.email, senha: payload.senha });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeTruthy();
    expect(extractCookie(loginRes, 'refresh_token')).toBeTruthy();
  });
});

describe('POST /auth/refresh — rotação e detecção de reuso', () => {
  it('rotaciona o token a cada uso e revoga a família inteira se um token já usado for reapresentado', async () => {
    const suffix = randomUUID().slice(0, 8);
    const payload = signupPayload(suffix);
    const signupRes = await request(app).post('/auth/signup').send(payload);
    createdTenantIds.push(signupRes.body.user.tenant.id);

    const originalCookie = extractCookie(signupRes, 'refresh_token')!;
    expect(originalCookie).toBeTruthy();

    // 1ª rotação: usa o cookie original, recebe um novo.
    const firstRefresh = await request(app).post('/auth/refresh').set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = extractCookie(firstRefresh, 'refresh_token')!;
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(originalCookie);

    // Reapresentar o cookie ORIGINAL (já revogado pela rotação acima) deve
    // ser tratado como possível roubo: nega e revoga a família inteira.
    const reuseAttempt = await request(app).post('/auth/refresh').set('Cookie', originalCookie);
    expect(reuseAttempt.status).toBe(401);

    // Por causa da revogação de família, o token ROTACIONADO (que era
    // válido até agora) também deve ter sido derrubado.
    const afterFamilyRevocation = await request(app).post('/auth/refresh').set('Cookie', rotatedCookie);
    expect(afterFamilyRevocation.status).toBe(401);
  });
});

describe('Rate limit de login (5 tentativas / 15min por e-mail+IP)', () => {
  it('bloqueia com 429 depois de 5 tentativas', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `rate-limit-${suffix}@teste-auth.com`;

    let lastStatus = 0;
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/auth/login').send({ email, senha: 'SenhaErrada999' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(401);

    const sixth = await request(app).post('/auth/login').send({ email, senha: 'SenhaErrada999' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RATE_LIMITED');
  });
});
