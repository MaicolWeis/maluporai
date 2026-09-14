import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { emailService } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];

function signupPayload(suffix: string) {
  return {
    nomeFantasia: `Empresa Reset ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-reset-${suffix}@teste-auth.com`,
    senha: `SenhaForte-${suffix}-9x`,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
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

function extractResetToken(html: string): string {
  const match = html.match(/\/redefinir-senha\/([^"<\s]+)/);
  if (!match) throw new Error('Token de reset não encontrado no e-mail simulado');
  return match[1];
}

describe('POST /auth/esqueci-senha e /auth/redefinir-senha', () => {
  it('responde a mesma mensagem para e-mail existente e inexistente', async () => {
    const suffix = randomUUID().slice(0, 8);
    const signupRes = await request(app).post('/auth/signup').send(signupPayload(suffix));
    createdTenantIds.push(signupRes.body.user.tenant.id);

    const sendSpy = vi.spyOn(emailService, 'send').mockResolvedValue(undefined);

    const existing = await request(app)
      .post('/auth/esqueci-senha')
      .send({ email: signupPayload(suffix).email });
    const inexistente = await request(app)
      .post('/auth/esqueci-senha')
      .send({ email: `nao-existe-${suffix}@teste-auth.com` });

    expect(existing.status).toBe(200);
    expect(inexistente.status).toBe(200);
    expect(existing.body.message).toBe(inexistente.body.message);
    // só dispara e-mail de verdade quando o usuário existe
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('redefine a senha com um token válido e revoga sessões anteriores', async () => {
    const suffix = randomUUID().slice(0, 8);
    const payload = signupPayload(suffix);
    const signupRes = await request(app).post('/auth/signup').send(payload);
    createdTenantIds.push(signupRes.body.user.tenant.id);
    const oldRefreshCookie = (signupRes.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refresh_token='),
    )!;

    let capturedHtml = '';
    vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
      capturedHtml = msg.html;
    });

    await request(app).post('/auth/esqueci-senha').send({ email: payload.email });
    const token = extractResetToken(capturedHtml);

    const novaSenha = `NovaSenhaForte-${suffix}-9x`;
    const resetRes = await request(app).post('/auth/redefinir-senha').send({ token, senha: novaSenha });
    expect(resetRes.status).toBe(200);

    // login com a senha antiga deve falhar; com a nova, funcionar.
    const loginComSenhaAntiga = await request(app)
      .post('/auth/login')
      .send({ email: payload.email, senha: payload.senha });
    expect(loginComSenhaAntiga.status).toBe(401);

    const loginComNovaSenha = await request(app)
      .post('/auth/login')
      .send({ email: payload.email, senha: novaSenha });
    expect(loginComNovaSenha.status).toBe(200);

    // a sessão criada no signup (antes da redefinição) foi revogada.
    const refreshComSessaoAntiga = await request(app).post('/auth/refresh').set('Cookie', oldRefreshCookie);
    expect(refreshComSessaoAntiga.status).toBe(401);
  });

  it('recusa token de reset inválido', async () => {
    const res = await request(app)
      .post('/auth/redefinir-senha')
      .send({ token: 'token-que-nunca-existiu-1234567890', senha: 'OutraSenhaForte123' });
    expect(res.status).toBe(400);
  });
});
