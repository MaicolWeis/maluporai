import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { consolidar, hojeBrasil } from '../src/services/financeiro.service.js';
import { Prisma } from '@prisma/client';

const app = createApp();
const createdTenantIds: string[] = [];

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Financeiro ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-fin-${suffix}@teste-financeiro.com`,
      senha: `SenhaForte-${suffix}-9x`,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return res.body.accessToken as string;
}

function isoEmDias(dias: number) {
  const d = hojeBrasil();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function criarViagemAberta(token: string, inicioEmDias: number, nome = 'Viagem Financeiro') {
  const v = await request(app)
    .post('/viagens')
    .set(auth(token))
    .send({
      nome,
      destinoCidade: 'Foz do Iguaçu',
      destinoUf: 'PR',
      dataInicio: isoEmDias(inicioEmDias),
      dataFim: isoEmDias(inicioEmDias + 3),
      capacidade: 30,
      precoTitular: 1000,
      precoAcompanhante: 600,
    });
  await request(app).patch(`/viagens/${v.body.viagem.id}/status`).set(auth(token)).send({ status: 'inscricoes' });
  return v.body.viagem.id as string;
}

async function inscrever(token: string, viagemId: string, valorTotal: number, pago: number) {
  const cliente = await request(app)
    .post('/clientes')
    .set(auth(token))
    .send({ nome: `Cliente ${randomUUID().slice(0, 6)}`, telefone: '47900000000' });
  const insc = await request(app)
    .post(`/viagens/${viagemId}/inscricoes`)
    .set(auth(token))
    .send({ clienteId: cliente.body.cliente.id, valorTotal });
  if (pago > 0) {
    await request(app)
      .post(`/inscricoes/${insc.body.inscricao.id}/pagamentos`)
      .set(auth(token))
      .send({ valor: pago, forma: 'Pix', dataPagamento: isoEmDias(0) });
  }
  return insc.body.inscricao.id as string;
}

afterAll(async () => {
  const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await admin.pagamento.deleteMany({ where: { tenantId } });
    await admin.inscricao.deleteMany({ where: { tenantId } });
    await admin.despesa.deleteMany({ where: { tenantId } });
    await admin.viagem.deleteMany({ where: { tenantId } });
    await admin.cliente.deleteMany({ where: { tenantId } });
    await admin.refreshToken.deleteMany({ where: { tenantId } });
    await admin.auditLog.deleteMany({ where: { tenantId } });
    await admin.user.deleteMany({ where: { tenantId } });
    await admin.tenantSettings.deleteMany({ where: { tenantId } });
    await admin.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
  await admin.$disconnect();
  await prisma.$disconnect();
});

describe('consolidar (unitário)', () => {
  const d = (n: number) => new Prisma.Decimal(n);
  it('sem inscrições: tudo zero e margem nula', () => {
    const r = consolidar([], []);
    expect(r.receitaPrevista.toString()).toBe('0');
    expect(r.margemPrevista).toBeNull();
  });
  it('lista de espera não entra na receita prevista nem no a receber', () => {
    const r = consolidar([{ status: 'lista_espera', valorTotal: d(500), pagamentos: [] }], []);
    expect(r.receitaPrevista.toString()).toBe('0');
    expect(r.aReceber.toString()).toBe('0');
  });
});

describe('GET /viagens/:id/financeiro', () => {
  it('consolida prevista, recebido, a receber, despesas, a devolver, resultados e margem', async () => {
    const token = await criarTenant();
    const viagemId = await criarViagemAberta(token, 60);

    await inscrever(token, viagemId, 1000, 1000); // quitada
    await inscrever(token, viagemId, 1600, 600); // parcial: saldo 1000
    const cancelada = await inscrever(token, viagemId, 1000, 300); // será cancelada: devolver 300
    await request(app).post(`/inscricoes/${cancelada}/cancelar`).set(auth(token)).send({ motivo: 'Desistência' });

    await request(app)
      .post(`/viagens/${viagemId}/despesas`)
      .set(auth(token))
      .send({ categoria: 'Hotel', descricao: 'Hotel', valor: 900, dataDespesa: isoEmDias(0) });

    const res = await request(app).get(`/viagens/${viagemId}/financeiro`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.financeiro).toEqual({
      receitaPrevista: '2600',
      recebido: '1600',
      aReceber: '1000',
      despesas: '900',
      aDevolver: '300',
      resultadoAtual: '700',
      resultadoPrevisto: '1700',
      margemPrevista: 65.4,
    });
  });

  it('viagem de outro tenant responde 404', async () => {
    const a = await criarTenant();
    const b = await criarTenant();
    const viagemA = await criarViagemAberta(a, 60);
    const res = await request(app).get(`/viagens/${viagemA}/financeiro`).set(auth(b));
    expect(res.status).toBe(404);
  });
});

describe('GET /dashboard', () => {
  it('lista próximas viagens, pendências (viagem em < 30 dias) e resultado por viagem, só do próprio tenant', async () => {
    const token = await criarTenant();
    const outro = await criarTenant();
    const proxima = await criarViagemAberta(token, 10, 'Próxima');
    const distante = await criarViagemAberta(token, 90, 'Distante');
    await inscrever(token, proxima, 1000, 400); // pendência: saldo 600
    await inscrever(token, distante, 1000, 0); // fora da janela de 30 dias
    await criarViagemAberta(outro, 5, 'Do outro tenant');

    const res = await request(app).get('/dashboard').set(auth(token));
    expect(res.status).toBe(200);

    expect(res.body.proximasViagens.map((v: { nome: string }) => v.nome)).toEqual(['Próxima', 'Distante']);
    expect(res.body.pendencias).toHaveLength(1);
    expect(res.body.pendencias[0]).toMatchObject({ viagemNome: 'Próxima', saldo: '600', valorPago: '400' });
    expect(res.body.resultadoPorViagem).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('Do outro tenant');
  });
});
