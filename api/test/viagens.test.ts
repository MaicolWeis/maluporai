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
    nomeFantasia: `Empresa Viagens ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-viagens-${suffix}@teste-viagens.com`,
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
  const email = `operador-viagens-${randomUUID().slice(0, 8)}@teste-viagens.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });

  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: 'Operador Viagens', email, papel: 'operador' });
  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  return loginRes.body.accessToken;
}

function viagemPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    nome: 'Bariloche de Moto',
    destinoCidade: 'Bariloche',
    destinoUf: 'RS',
    dataInicio: '2027-03-01',
    dataFim: '2027-03-10',
    capacidade: 40,
    precoTitular: 4500,
    precoAcompanhante: 4000,
    ...overrides,
  };
}

/** Cria um cliente + inscrição direto via Prisma (CRUD de inscrições é do P7). */
async function criarInscricaoFixture(
  tenantId: string,
  viagemId: string,
  opts: { valorTotal: number; status?: 'confirmada' | 'cancelada' | 'lista_espera'; levaAcompanhante?: boolean },
) {
  return runWithTenant(tenantId, async () => {
    const cliente = await prisma.cliente.create({
      data: { nome: `Cliente ${randomUUID().slice(0, 6)}`, telefone: '11900000000' },
    });
    return prisma.inscricao.create({
      data: {
        viagemId,
        clienteId: cliente.id,
        valorTotal: opts.valorTotal,
        status: opts.status ?? 'confirmada',
        levaAcompanhante: opts.levaAcompanhante ?? false,
      },
    });
  });
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

describe('CRUD básico de viagens', () => {
  it('admin cria, lê, atualiza e operador também acessa (módulo "viagens")', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);

    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    expect(criarRes.status).toBe(201);
    expect(criarRes.body.viagem.status).toBe('planejamento');
    const viagemId = criarRes.body.viagem.id;

    const listaOperador = await request(app).get('/viagens').set('Authorization', `Bearer ${operadorToken}`);
    expect(listaOperador.status).toBe(200);
    expect(listaOperador.body.viagens.some((v: { id: string }) => v.id === viagemId)).toBe(true);

    const patchRes = await request(app)
      .patch(`/viagens/${viagemId}`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ capacidade: 50 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.viagem.agregados.capacidade).toBe(50);
  });

  it('isolamento: viagem de outro tenant responde 404 (nunca 403)', async () => {
    const { adminAccessToken: tokenA } = await criarTenantComAdmin();
    const { adminAccessToken: tokenB } = await criarTenantComAdmin();

    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    const res = await request(app).get(`/viagens/${viagemId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

describe('Regra: transições de status inválidas rejeitadas', () => {
  it('rejeita pular direto de planejamento para confirmada', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    const res = await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'confirmada' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRANSICAO_INVALIDA');
  });

  it('rejeita transição a partir de um estado terminal (concluida)', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    for (const status of ['inscricoes', 'confirmada', 'concluida']) {
      const res = await request(app)
        .patch(`/viagens/${viagemId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }

    const res = await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'inscricoes' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRANSICAO_INVALIDA');
  });

  it('permite a sequência válida completa planejamento → inscricoes → confirmada → concluida', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    for (const status of ['inscricoes', 'confirmada', 'concluida']) {
      const res = await request(app)
        .patch(`/viagens/${viagemId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.viagem.status).toBe(status);
    }
  });
});

describe('Regra: cancelamento com inscrições exige motivo', () => {
  it('rejeita cancelar sem motivo quando há inscrição ativa, e cancela as inscrições quando o motivo é informado', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    const inscricao = await criarInscricaoFixture(tenantId, viagemId, { valorTotal: 1000 });

    const semMotivo = await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'cancelada' });
    expect(semMotivo.status).toBe(400);
    expect(semMotivo.body.error.code).toBe('MOTIVO_OBRIGATORIO');

    const comMotivo = await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'cancelada', motivo: 'Baixa procura' });
    expect(comMotivo.status).toBe(200);
    expect(comMotivo.body.viagem.status).toBe('cancelada');

    const inscricaoAtualizada = await runWithTenant(tenantId, () =>
      prisma.inscricao.findUniqueOrThrow({ where: { id: inscricao.id } }),
    );
    expect(inscricaoAtualizada.status).toBe('cancelada');
  });

  it('cancela sem exigir motivo quando não há inscrições', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    const res = await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'cancelada' });
    expect(res.status).toBe(200);
  });
});

describe('Regra: DELETE só em planejamento sem inscrições', () => {
  it('bloqueia com 409 quando a viagem não está em planejamento', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    await request(app)
      .patch(`/viagens/${viagemId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ status: 'inscricoes' });

    const res = await request(app).delete(`/viagens/${viagemId}`).set('Authorization', `Bearer ${adminAccessToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VIAGEM_NAO_EDITAVEL');
  });

  it('bloqueia com 409 quando há inscrição, mesmo em planejamento', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;
    await criarInscricaoFixture(tenantId, viagemId, { valorTotal: 500 });

    const res = await request(app).delete(`/viagens/${viagemId}`).set('Authorization', `Bearer ${adminAccessToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VIAGEM_COM_INSCRICAO');
  });

  it('permite excluir em planejamento sem inscrições (e junto o conteúdo de logística)', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    await request(app)
      .post(`/viagens/${viagemId}/hoteis`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Hotel Central' });

    const res = await request(app).delete(`/viagens/${viagemId}`).set('Authorization', `Bearer ${adminAccessToken}`);
    expect(res.status).toBe(204);

    const obterRes = await request(app)
      .get(`/viagens/${viagemId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(obterRes.status).toBe(404);
  });
});

describe('Regra: agregados (pessoas/recebido/despesas) calculados corretamente', () => {
  it('soma pessoas confirmadas (titular + acompanhante), recebido e despesas, ignorando inscrição cancelada', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload({ capacidade: 40 }));
    const viagemId = criarRes.body.viagem.id;

    // Inscrição 1: confirmada, com acompanhante → 2 pessoas, paga 1000.
    const inscricao1 = await criarInscricaoFixture(tenantId, viagemId, {
      valorTotal: 2000,
      status: 'confirmada',
      levaAcompanhante: true,
    });
    // Inscrição 2: confirmada, sem acompanhante → 1 pessoa, paga 500.
    const inscricao2 = await criarInscricaoFixture(tenantId, viagemId, {
      valorTotal: 1500,
      status: 'confirmada',
      levaAcompanhante: false,
    });
    // Inscrição 3: cancelada → não conta em pessoas nem em recebido.
    const inscricao3 = await criarInscricaoFixture(tenantId, viagemId, {
      valorTotal: 900,
      status: 'cancelada',
      levaAcompanhante: false,
    });

    await runWithTenant(tenantId, async () => {
      await prisma.pagamento.create({
        data: { inscricaoId: inscricao1.id, valor: 1000, forma: 'pix', dataPagamento: new Date('2027-01-01') },
      });
      await prisma.pagamento.create({
        data: { inscricaoId: inscricao2.id, valor: 500, forma: 'cartao', dataPagamento: new Date('2027-01-02') },
      });
      // Pagamento numa inscrição cancelada não deve contar como recebido.
      await prisma.pagamento.create({
        data: { inscricaoId: inscricao3.id, valor: 900, forma: 'pix', dataPagamento: new Date('2027-01-03') },
      });
      await prisma.despesa.create({
        data: {
          viagemId,
          categoria: 'combustivel',
          descricao: 'Diesel ida',
          valor: 300,
          dataDespesa: new Date('2027-01-04'),
        },
      });
      await prisma.despesa.create({
        data: {
          viagemId,
          categoria: 'pedagio',
          descricao: 'Pedágios',
          valor: 50,
          dataDespesa: new Date('2027-01-05'),
        },
      });
    });

    const detalheRes = await request(app)
      .get(`/viagens/${viagemId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(detalheRes.status).toBe(200);
    expect(detalheRes.body.viagem.agregados).toEqual({
      pessoasConfirmadas: 3, // 1 (sem acompanhante) + 2 (com acompanhante)
      capacidade: 40,
      totalRecebido: '1500',
      totalDespesas: '350',
    });

    const listaRes = await request(app).get('/viagens').set('Authorization', `Bearer ${adminAccessToken}`);
    const itemLista = listaRes.body.viagens.find((v: { id: string }) => v.id === viagemId);
    expect(itemLista.pessoasConfirmadas).toBe(3);
    expect(itemLista.totalRecebido).toBe('1500');
    expect(itemLista.totalDespesas).toBe('350');
  });
});

describe('Sub-recursos: hotéis, atrações e inclusos', () => {
  it('CRUD completo dos três sub-recursos, escopado à viagem', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/viagens')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send(viagemPayload());
    const viagemId = criarRes.body.viagem.id;

    const hotelRes = await request(app)
      .post(`/viagens/${viagemId}/hoteis`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Hotel das Cataratas', cidade: 'Foz do Iguaçu' });
    expect(hotelRes.status).toBe(201);

    const patchHotelRes = await request(app)
      .patch(`/viagens/${viagemId}/hoteis/${hotelRes.body.hotel.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valorNegociado: 3200.5 });
    expect(patchHotelRes.status).toBe(200);
    expect(Number(patchHotelRes.body.hotel.valorNegociado)).toBe(3200.5);

    const atracaoRes = await request(app)
      .post(`/viagens/${viagemId}/atracoes`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Parque das Aves', tipo: 'parque', incluso: true });
    expect(atracaoRes.status).toBe(201);

    const inclusoRes = await request(app)
      .post(`/viagens/${viagemId}/inclusos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ descricao: 'Café da manhã', ordem: 1 });
    expect(inclusoRes.status).toBe(201);

    const detalheRes = await request(app)
      .get(`/viagens/${viagemId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(detalheRes.body.viagem.hoteis).toHaveLength(1);
    expect(detalheRes.body.viagem.atracoes).toHaveLength(1);
    expect(detalheRes.body.viagem.inclusos).toHaveLength(1);

    const deleteRes = await request(app)
      .delete(`/viagens/${viagemId}/atracoes/${atracaoRes.body.atracao.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(deleteRes.status).toBe(204);

    const detalheDepois = await request(app)
      .get(`/viagens/${viagemId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(detalheDepois.body.viagem.atracoes).toHaveLength(0);
  });

  it('sub-recurso de outra viagem (mesmo tenant) responde 404', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const viagem1 = (
      await request(app).post('/viagens').set('Authorization', `Bearer ${adminAccessToken}`).send(viagemPayload())
    ).body.viagem;
    const viagem2 = (
      await request(app).post('/viagens').set('Authorization', `Bearer ${adminAccessToken}`).send(viagemPayload())
    ).body.viagem;

    const hotel = (
      await request(app)
        .post(`/viagens/${viagem1.id}/hoteis`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ nome: 'Hotel X' })
    ).body.hotel;

    const res = await request(app)
      .patch(`/viagens/${viagem2.id}/hoteis/${hotel.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Tentando editar via outra viagem' });
    expect(res.status).toBe(404);
  });
});
