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


describe('Status do cliente', () => {
  it('ativo por padrão; filtra por status; bloqueado não pode ser inscrito e guarda o motivo só enquanto bloqueado', async () => {
    const { adminAccessToken: token } = await criarTenantComAdmin();
    const viagem = await criarViagem(token, { capacidade: 5 });
    await abrirInscricoes(token, viagem.id);
    const cliente = await criarCliente(token);

    const detalhe = await request(app).get(`/clientes/${cliente.id}`).set('Authorization', `Bearer ${token}`);
    expect(detalhe.body.cliente).toMatchObject({ status: 'ativo', motivoBloqueio: null });

    const bloquear = await request(app)
      .patch(`/clientes/${cliente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'bloqueado', motivoBloqueio: 'Pagamento em aberto de viagem anterior' });
    expect(bloquear.status).toBe(200);
    expect(bloquear.body.cliente).toMatchObject({ status: 'bloqueado', motivoBloqueio: 'Pagamento em aberto de viagem anterior' });

    const inscricao = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: cliente.id });
    expect(inscricao.status).toBe(409);
    expect(inscricao.body.error.code).toBe('CLIENTE_BLOQUEADO');

    const filtrados = await request(app).get('/clientes').query({ status: 'bloqueado' }).set('Authorization', `Bearer ${token}`);
    expect(filtrados.body.clientes.map((c: { id: string }) => c.id)).toEqual([cliente.id]);
    const ativos = await request(app).get('/clientes').query({ status: 'ativo' }).set('Authorization', `Bearer ${token}`);
    expect(ativos.body.clientes).toHaveLength(0);

    const inativar = await request(app)
      .patch(`/clientes/${cliente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inativo' });
    expect(inativar.body.cliente).toMatchObject({ status: 'inativo', motivoBloqueio: null });

    const inscreveInativo = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: cliente.id });
    expect(inscreveInativo.status).toBe(201);

    const invalido = await request(app)
      .patch(`/clientes/${cliente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'suspenso' });
    expect(invalido.status).toBe(400);
  });
});
