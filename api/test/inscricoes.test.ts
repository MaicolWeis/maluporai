import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenant-context.js';
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

describe('Regra: inscrição só em viagem com status inscricoes/confirmada', () => {
  it('rejeita inscrição em viagem ainda em planejamento e aceita depois de abrir inscrições', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken);
    const cliente = await criarCliente(adminAccessToken);

    const emPlanejamento = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente.id });
    expect(emPlanejamento.status).toBe(400);
    expect(emPlanejamento.body.error.code).toBe('VIAGEM_FORA_DO_PERIODO_DE_INSCRICAO');

    await abrirInscricoes(adminAccessToken, viagem.id);

    const comInscricoesAbertas = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente.id });
    expect(comInscricoesAbertas.status).toBe(201);
    expect(comInscricoesAbertas.body.inscricao.status).toBe('confirmada');
    // Valor default: preço titular (sem acompanhante).
    expect(comInscricoesAbertas.body.inscricao.valorTotal).toBe('1000');
  });
});

describe('Regra: unique cliente por viagem (409)', () => {
  it('rejeita uma segunda inscrição do mesmo cliente na mesma viagem', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken);
    await abrirInscricoes(adminAccessToken, viagem.id);
    const cliente = await criarCliente(adminAccessToken);

    const primeira = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente.id });
    expect(primeira.status).toBe(201);

    const segunda = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente.id });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('CLIENTE_JA_INSCRITO');
  });
});

describe('Regra: bloqueio acima da capacidade contando acompanhantes', () => {
  it('rejeita quando titular + acompanhante estourariam a capacidade', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken, { capacidade: 2 });
    await abrirInscricoes(adminAccessToken, viagem.id);

    const cliente1 = await criarCliente(adminAccessToken);
    const comAcompanhante = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente1.id, levaAcompanhante: true, nomeAcompanhante: 'Fulano' });
    expect(comAcompanhante.status).toBe(201); // 2 pessoas, capacidade cheia

    const cliente2 = await criarCliente(adminAccessToken);
    const excedente = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente2.id });
    expect(excedente.status).toBe(400);
    expect(excedente.body.error.code).toBe('CAPACIDADE_EXCEDIDA');
  });
});

describe('Regra: lista_espera não conta na ocupação', () => {
  it('permite lista de espera além da capacidade e não bloqueia outras vagas', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken, { capacidade: 1 });
    await abrirInscricoes(adminAccessToken, viagem.id);

    const cliente1 = await criarCliente(adminAccessToken);
    const confirmada = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente1.id });
    expect(confirmada.status).toBe(201);

    // Capacidade já cheia (1/1) — uma nova confirmada seria rejeitada, mas
    // lista_espera é explicitamente permitida e não conta na ocupação.
    const cliente2 = await criarCliente(adminAccessToken);
    const listaEspera = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente2.id, status: 'lista_espera' });
    expect(listaEspera.status).toBe(201);
    expect(listaEspera.body.inscricao.status).toBe('lista_espera');

    const listaRes = await request(app)
      .get(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(listaRes.body.pessoasConfirmadas).toBe(1);
    expect(listaRes.body.vagasRestantes).toBe(0);

    // Agregados do P6 (viagem) também devem refletir só a confirmada.
    const viagemDetalhe = await request(app)
      .get(`/viagens/${viagem.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(viagemDetalhe.body.viagem.agregados.pessoasConfirmadas).toBe(1);
  });
});

describe('Regra: cancelamento exige motivo e preserva pagamentos', () => {
  it('rejeita cancelar sem motivo e mantém o pagamento após cancelar com motivo', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const viagem = await criarViagem(adminAccessToken);
    await abrirInscricoes(adminAccessToken, viagem.id);
    const cliente = await criarCliente(adminAccessToken);

    const criarRes = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ clienteId: cliente.id });
    const inscricaoId = criarRes.body.inscricao.id;

    const pagamentoId = await runWithTenant(tenantId, async () => {
      const pagamento = await prisma.pagamento.create({
        data: { inscricaoId, valor: 300, forma: 'pix', dataPagamento: new Date('2027-01-01') },
      });
      return pagamento.id;
    });

    const semMotivo = await request(app)
      .post(`/inscricoes/${inscricaoId}/cancelar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({});
    expect(semMotivo.status).toBe(400);

    const comMotivo = await request(app)
      .post(`/inscricoes/${inscricaoId}/cancelar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ motivo: 'Desistência do cliente' });
    expect(comMotivo.status).toBe(200);
    expect(comMotivo.body.inscricao.status).toBe('cancelada');

    const pagamento = await runWithTenant(tenantId, () =>
      prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } }),
    );
    expect(pagamento.id).toBe(pagamentoId);
    expect(Number(pagamento.valor)).toBe(300);

    // Cancelar de novo é rejeitado — não existe "descancelar".
    const denovo = await request(app)
      .post(`/inscricoes/${inscricaoId}/cancelar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ motivo: 'Outra tentativa' });
    expect(denovo.status).toBe(400);
    expect(denovo.body.error.code).toBe('JA_CANCELADA');
  });
});

describe('Isolamento entre tenants (404)', () => {
  it('inscrição de outro tenant responde 404 em PATCH e cancelar', async () => {
    const { adminAccessToken: tokenA } = await criarTenantComAdmin();
    const { adminAccessToken: tokenB } = await criarTenantComAdmin();

    const viagemA = await criarViagem(tokenA);
    await abrirInscricoes(tokenA, viagemA.id);
    const clienteA = await criarCliente(tokenA);
    const criarRes = await request(app)
      .post(`/viagens/${viagemA.id}/inscricoes`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clienteId: clienteA.id });
    const inscricaoId = criarRes.body.inscricao.id;

    const patchRes = await request(app)
      .patch(`/inscricoes/${inscricaoId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ seguroViagem: true });
    expect(patchRes.status).toBe(404);

    const cancelarRes = await request(app)
      .post(`/inscricoes/${inscricaoId}/cancelar`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ motivo: 'Tentando de outro tenant' });
    expect(cancelarRes.status).toBe(404);
  });

  it('criar inscrição numa viagem de outro tenant responde 404', async () => {
    const { adminAccessToken: tokenA } = await criarTenantComAdmin();
    const { adminAccessToken: tokenB } = await criarTenantComAdmin();

    const viagemA = await criarViagem(tokenA);
    await abrirInscricoes(tokenA, viagemA.id);
    const clienteB = await criarCliente(tokenB);

    const res = await request(app)
      .post(`/viagens/${viagemA.id}/inscricoes`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ clienteId: clienteB.id });
    expect(res.status).toBe(404);
  });
});

describe('CRUD básico: PATCH altera acompanhante/seguro/valor, operador tem acesso', () => {
  it('admin cria, operador lista e atualiza (módulo "inscricoes")', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);
    const viagem = await criarViagem(adminAccessToken);
    await abrirInscricoes(adminAccessToken, viagem.id);
    const cliente = await criarCliente(adminAccessToken);

    const criarRes = await request(app)
      .post(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ clienteId: cliente.id, seguroViagem: false });
    expect(criarRes.status).toBe(201);
    const inscricaoId = criarRes.body.inscricao.id;

    const patchRes = await request(app)
      .patch(`/inscricoes/${inscricaoId}`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ seguroViagem: true, seguradora: 'Porto Seguro', numeroApolice: '12345', valorTotal: 1200 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.inscricao.seguroViagem).toBe(true);
    expect(patchRes.body.inscricao.valorTotal).toBe('1200');
    expect(patchRes.body.inscricao.statusPagamento).toBe('pendente'); // sem pagamentos ainda (P8)

    const listaRes = await request(app)
      .get(`/viagens/${viagem.id}/inscricoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(listaRes.body.inscricoes).toHaveLength(1);
    expect(listaRes.body.inscricoes[0].cliente.id).toBe(cliente.id);
  });
});
