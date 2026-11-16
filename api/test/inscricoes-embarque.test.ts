import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { emailService } from '../src/services/email.service.js';

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

function extractActivationToken(html: string): string {
  const match = html.match(/\/ativar-conta\/([^"<\s]+)/);
  if (!match) throw new Error('Token de ativação não encontrado no e-mail simulado');
  return match[1];
}

async function criarOperadorLogado(adminAccessToken: string): Promise<string> {
  const email = `operador-inscricoes-${randomUUID().slice(0, 8)}@teste-inscricoes.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });

  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: 'Operador Inscrições', email, papel: 'operador' });
  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  return loginRes.body.accessToken;
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

const embarcar = (token: string, id: string, embarcado: boolean) =>
  request(app).post(`/inscricoes/${id}/embarque`).set('Authorization', `Bearer ${token}`).send({ embarcado });

const listar = (token: string, viagemId: string) =>
  request(app).get(`/viagens/${viagemId}/inscricoes`).set('Authorization', `Bearer ${token}`);

describe('Lista de embarque', () => {
  it('operador marca e desmarca embarque, conta pessoas com acompanhante e audita', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operador = await criarOperadorLogado(adminAccessToken);
    const viagem = await criarViagem(adminAccessToken, { capacidade: 5 });
    await abrirInscricoes(adminAccessToken, viagem.id);
    const comAcomp = await inscrever(adminAccessToken, viagem.id, (await criarCliente(adminAccessToken)).id, {
      levaAcompanhante: true,
      nomeAcompanhante: 'Maria',
    });
    const sozinho = await inscrever(adminAccessToken, viagem.id, (await criarCliente(adminAccessToken)).id);
    expect(comAcomp.embarcadoEm).toBeNull();

    const marcado = await embarcar(operador, comAcomp.id, true);
    expect(marcado.status).toBe(200);
    const primeiroHorario = marcado.body.inscricao.embarcadoEm;
    expect(primeiroHorario).toBeTruthy();

    // Idempotente: marcar de novo mantém o horário do primeiro embarque.
    const repetido = await embarcar(operador, comAcomp.id, true);
    expect(repetido.body.inscricao.embarcadoEm).toBe(primeiroHorario);

    let lista = await listar(operador, viagem.id);
    expect(lista.body.pessoasEmbarcadas).toBe(2);
    expect(lista.body.pessoasConfirmadas).toBe(3);

    // Marcação feita sem internet e sincronizada depois mantém o horário real.
    const horaReal = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sincronizada = await request(app)
      .post(`/inscricoes/${sozinho.id}/embarque`)
      .set('Authorization', `Bearer ${operador}`)
      .send({ embarcado: true, em: horaReal });
    expect(sincronizada.status).toBe(200);
    expect(sincronizada.body.inscricao.embarcadoEm).toBe(horaReal);
    expect((await listar(operador, viagem.id)).body.pessoasEmbarcadas).toBe(3);

    const desfeito = await embarcar(operador, sozinho.id, false);
    expect(desfeito.body.inscricao.embarcadoEm).toBeNull();
    lista = await listar(operador, viagem.id);
    expect(lista.body.pessoasEmbarcadas).toBe(2);

    const auditoria = await request(app)
      .get('/auditoria')
      .query({ entidade: 'inscricao' })
      .set('Authorization', `Bearer ${adminAccessToken}`);
    const acoes = JSON.stringify(auditoria.body);
    expect(acoes).toContain('embarcou');
  });

  it('rejeita embarque de inscrição fora da lista confirmada, payload inválido e inscrição de outro tenant', async () => {
    const a = await criarTenantComAdmin();
    const b = await criarTenantComAdmin();
    const viagem = await criarViagem(a.adminAccessToken, { capacidade: 1 });
    await abrirInscricoes(a.adminAccessToken, viagem.id);
    await inscrever(a.adminAccessToken, viagem.id, (await criarCliente(a.adminAccessToken)).id);
    const espera = await inscrever(a.adminAccessToken, viagem.id, (await criarCliente(a.adminAccessToken)).id, {
      status: 'lista_espera',
    });

    const r1 = await embarcar(a.adminAccessToken, espera.id, true);
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('INSCRICAO_NAO_CONFIRMADA');

    const r2 = await request(app)
      .post(`/inscricoes/${espera.id}/embarque`)
      .set('Authorization', `Bearer ${a.adminAccessToken}`)
      .send({ embarcado: 'sim' });
    expect(r2.status).toBe(400);

    const futuro = await request(app)
      .post(`/inscricoes/${espera.id}/embarque`)
      .set('Authorization', `Bearer ${a.adminAccessToken}`)
      .send({ embarcado: true, em: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    expect(futuro.status).toBe(400);

    const r3 = await embarcar(b.adminAccessToken, espera.id, true);
    expect(r3.status).toBe(404);
  });

  it('não permite marcar embarque depois que a viagem foi concluída', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken);
    await abrirInscricoes(adminAccessToken, viagem.id);
    const insc = await inscrever(adminAccessToken, viagem.id, (await criarCliente(adminAccessToken)).id);
    for (const status of ['confirmada', 'concluida']) {
      await request(app)
        .patch(`/viagens/${viagem.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status });
    }
    const r = await embarcar(adminAccessToken, insc.id, true);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('VIAGEM_SEM_EMBARQUE');
  });
});
