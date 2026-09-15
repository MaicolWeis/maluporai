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
    nomeFantasia: `Empresa Usuarios ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-usu-${suffix}@teste-usuarios.com`,
    senha: `SenhaForte-${suffix}-9x`,
  };
}

async function criarTenantComAdmin() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app).post('/auth/signup').send(signupPayload(suffix));
  createdTenantIds.push(res.body.user.tenant.id);
  return {
    suffix,
    tenantId: res.body.user.tenant.id as string,
    adminId: res.body.user.id as string,
    adminEmail: signupPayload(suffix).email,
    adminSenha: signupPayload(suffix).senha,
    adminAccessToken: res.body.accessToken as string,
  };
}

function extractActivationToken(html: string): string {
  const match = html.match(/\/ativar-conta\/([^"<\s]+)/);
  if (!match) throw new Error('Token de ativação não encontrado no e-mail simulado');
  return match[1];
}

/** Convida, captura o token via spy no EmailService, ativa e loga. */
async function convidarEAtivar(
  adminAccessToken: string,
  papel: 'admin' | 'operador',
  emailPrefix: string,
): Promise<{ userId: string; email: string; senha: string; accessToken: string }> {
  const email = `${emailPrefix}-${randomUUID().slice(0, 8)}@teste-usuarios.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });

  const conviteRes = await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: `Convidado ${papel}`, email, papel });
  expect(conviteRes.status).toBe(201);

  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaConvidado-${randomUUID().slice(0, 6)}-9x`;
  const ativarRes = await request(app).post('/auth/ativar-conta').send({ token, senha });
  expect(ativarRes.status).toBe(200);

  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  expect(loginRes.status).toBe(200);

  return { userId: conviteRes.body.usuario.id, email, senha, accessToken: loginRes.body.accessToken };
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.activationToken.deleteMany({ where: { tenantId } });
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

describe('Convite + ativação de conta (fluxo feliz)', () => {
  it('convida, ativa e lista o usuário', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operador = await convidarEAtivar(adminAccessToken, 'operador', 'op');

    const listaRes = await request(app)
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(listaRes.status).toBe(200);
    const encontrado = listaRes.body.usuarios.find((u: { id: string }) => u.id === operador.userId);
    expect(encontrado).toMatchObject({ email: operador.email, papel: 'operador', status: 'ativo' });
    expect(encontrado.senhaHash).toBeUndefined();
  });
});

describe('Regra: usuário não altera o próprio papel', () => {
  it('admin não consegue mudar o próprio papel, mesmo com permissão de admin', async () => {
    const { adminAccessToken, adminId } = await criarTenantComAdmin();

    const res = await request(app)
      .patch(`/usuarios/${adminId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ papel: 'operador' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('Regra: último admin ativo não pode ser rebaixado nem inativado', () => {
  it('não pode se auto-inativar sendo o único admin ativo', async () => {
    const { adminAccessToken, adminId } = await criarTenantComAdmin();

    const res = await request(app)
      .patch(`/usuarios/${adminId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'inativo' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('não deixa rebaixar o último admin ativo, mesmo agindo por outro usuário', async () => {
    const { adminAccessToken, adminId } = await criarTenantComAdmin();

    // Convida um segundo admin — enquanto há 2 admins ativos, dá pra
    // rebaixar um deles.
    const segundoAdmin = await convidarEAtivar(adminAccessToken, 'admin', 'admin2');

    const rebaixaSegundo = await request(app)
      .patch(`/usuarios/${segundoAdmin.userId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ papel: 'operador' });
    expect(rebaixaSegundo.status).toBe(200);

    // Agora só o admin original está ativo como admin. O token do segundo
    // admin foi emitido ANTES do rebaixamento (JWT stateless, 15min) — usa
    // esse token, ainda com papel "admin", pra tentar rebaixar o admin
    // original: a regra precisa valer mesmo com um ator diferente do alvo.
    const tentativa = await request(app)
      .patch(`/usuarios/${adminId}`)
      .set('Authorization', `Bearer ${segundoAdmin.accessToken}`)
      .send({ papel: 'operador' });

    expect(tentativa.status).toBe(400);
    expect(tentativa.body.error.code).toBe('LAST_ADMIN');
  });
});

describe('Regra: operador não acessa rotas de admin', () => {
  it('responde 403 em GET /usuarios e POST /usuarios/convites', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operador = await convidarEAtivar(adminAccessToken, 'operador', 'op403');

    const listaRes = await request(app)
      .get('/usuarios')
      .set('Authorization', `Bearer ${operador.accessToken}`);
    const conviteRes = await request(app)
      .post('/usuarios/convites')
      .set('Authorization', `Bearer ${operador.accessToken}`)
      .send({ nome: 'Outro', email: `outro-${randomUUID().slice(0, 8)}@teste-usuarios.com`, papel: 'operador' });

    expect(listaRes.status).toBe(403);
    expect(conviteRes.status).toBe(403);
  });
});

describe('Regra: token de ativação expirado é rejeitado', () => {
  it('recusa um token de ativação vencido', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const email = `expirado-${randomUUID().slice(0, 8)}@teste-usuarios.com`;

    let capturedHtml = '';
    const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
      capturedHtml = msg.html;
    });
    const conviteRes = await request(app)
      .post('/usuarios/convites')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Vai Expirar', email, papel: 'operador' });
    const token = extractActivationToken(capturedHtml);
    spy.mockRestore();

    // Volta o expires_at pro passado usando a role de admin (bypassa RLS) —
    // simula os 72h passados sem precisar esperar de verdade.
    const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
    await adminClient.activationToken.updateMany({
      where: { userId: conviteRes.body.usuario.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await adminClient.$disconnect();

    const res = await request(app).post('/auth/ativar-conta').send({ token, senha: 'SenhaQualquer123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ACTIVATION_TOKEN');
  });
});

describe('DELETE /usuarios/:id — apaga se nunca logou, senão inativa', () => {
  it('apaga de verdade um convidado que nunca ativou/logou', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const email = `nunca-logou-${randomUUID().slice(0, 8)}@teste-usuarios.com`;

    const conviteRes = await request(app)
      .post('/usuarios/convites')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Nunca Logou', email, papel: 'operador' });
    const targetId = conviteRes.body.usuario.id;

    const delRes = await request(app)
      .delete(`/usuarios/${targetId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(delRes.status).toBe(204);

    const listaRes = await request(app)
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(listaRes.body.usuarios.some((u: { id: string }) => u.id === targetId)).toBe(false);
  });

  it('inativa (não apaga) um usuário que já logou', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operador = await convidarEAtivar(adminAccessToken, 'operador', 'jalogou');

    const delRes = await request(app)
      .delete(`/usuarios/${operador.userId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(delRes.status).toBe(204);

    const listaRes = await request(app)
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    const encontrado = listaRes.body.usuarios.find((u: { id: string }) => u.id === operador.userId);
    expect(encontrado).toBeDefined();
    expect(encontrado.status).toBe('inativo');
  });
});
