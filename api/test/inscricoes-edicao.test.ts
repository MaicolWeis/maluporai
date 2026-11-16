import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const createdTenantIds: string[] = [];

function signupPayload(suffix: string) {
  return {
    nomeFantasia: `Empresa Inscricoes ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-inscricoes-${suffix}@teste-inscricoes.com`,
    senha: `SenhaForte-${suffix}-9x`,
    aceiteTermos: true,
  };
}

async function criarTenantComAdmin() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app).post('/auth/signup').send(signupPayload(suffix));
  createdTenantIds.push(res.body.user.tenant.id);
  return {
    tenantId: res.body.user.tenant.id as string,
    adminAccessToken: res.body.accessToken as string,
  };
}

async function criarViagem(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const res = await request(app)
    .post('/viagens')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nome: 'Bariloche de Moto',
      destinoCidade: 'Bariloche',
      destinoUf: 'RS',
      dataInicio: '2027-03-01',
      dataFim: '2027-03-10',
      capacidade: 2,
      precoTitular: 1000,
      precoAcompanhante: 800,
      ...overrides,
    });
  return res.body.viagem as { id: string; status: string };
}

async function abrirInscricoes(token: string, viagemId: string) {
  await request(app)
    .patch(`/viagens/${viagemId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'inscricoes' });
}

async function criarCliente(token: string, nome = `Cliente ${randomUUID().slice(0, 6)}`) {
  const res = await request(app)
    .post('/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome, telefone: '11900000000' });
  return res.body.cliente as { id: string };
}

afterAll(async () => {
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.pagamento.deleteMany({ where: { tenantId } });
    await adminClient.inscricao.deleteMany({ where: { tenantId } });
    await adminClient.despesa.deleteMany({ where: { tenantId } });
    await adminClient.viagemHotel.deleteMany({ where: { tenantId } });
    await adminClient.viagemAtracao.deleteMany({ where: { tenantId } });
    await adminClient.viagemIncluso.deleteMany({ where: { tenantId } });
    await adminClient.viagem.deleteMany({ where: { tenantId } });
    await adminClient.cliente.deleteMany({ where: { tenantId } });
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


async function inscrever(token: string, viagemId: string, clienteId: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/viagens/${viagemId}/inscricoes`)
    .set('Authorization', `Bearer ${token}`)
    .send({ clienteId, ...extra });
  return res.body.inscricao as { id: string; embarcadoEm: string | null };
}

const listar = (token: string, viagemId: string) =>
  request(app).get(`/viagens/${viagemId}/inscricoes`).set('Authorization', `Bearer ${token}`);

describe('Edição de inscrição: seguro e acompanhante', () => {
  it('grava e devolve seguradora/apólice/documento, e limpa ao desmarcar', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken, { capacidade: 5 });
    await abrirInscricoes(adminAccessToken, viagem.id);
    const insc = await inscrever(adminAccessToken, viagem.id, (await criarCliente(adminAccessToken)).id);

    const editar = (corpo: Record<string, unknown>) =>
      request(app).patch(`/inscricoes/${insc.id}`).set('Authorization', `Bearer ${adminAccessToken}`).send(corpo);

    const comSeguro = await editar({
      seguroViagem: true,
      seguradora: 'Porto Seguro',
      numeroApolice: 'AP-123',
      levaAcompanhante: true,
      nomeAcompanhante: 'Maria',
      docAcompanhante: 'RG 1234567',
    });
    expect(comSeguro.status).toBe(200);
    expect(comSeguro.body.inscricao).toMatchObject({
      seguroViagem: true,
      seguradora: 'Porto Seguro',
      numeroApolice: 'AP-123',
      nomeAcompanhante: 'Maria',
      docAcompanhante: 'RG 1234567',
    });

    const lista = await listar(adminAccessToken, viagem.id);
    expect(lista.body.inscricoes[0]).toMatchObject({ seguradora: 'Porto Seguro', numeroApolice: 'AP-123' });

    const semSeguro = await editar({ seguroViagem: false, seguradora: null, numeroApolice: null });
    expect(semSeguro.status).toBe(200);
    expect(semSeguro.body.inscricao).toMatchObject({ seguroViagem: false, seguradora: null, numeroApolice: null });
  });
});
