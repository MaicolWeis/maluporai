import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { emailService } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];

async function criarTenantComAdmin() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Despesas ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-despesas-${suffix}@teste-despesas.com`,
      senha: `SenhaForte-${suffix}-9x`,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return { tenantId: res.body.user.tenant.id as string, token: res.body.accessToken as string };
}

async function criarOperadorLogado(adminToken: string): Promise<string> {
  const email = `operador-despesas-${randomUUID().slice(0, 8)}@teste-despesas.com`;
  let html = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    html = msg.html;
  });
  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: 'Operador Despesas', email, papel: 'operador' });
  spy.mockRestore();
  const token = html.match(/\/ativar-conta\/([^"<\s]+)/)?.[1];
  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const login = await request(app).post('/auth/login').send({ email, senha });
  return login.body.accessToken;
}

async function criarViagem(token: string) {
  const res = await request(app)
    .post('/viagens')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nome: 'Serra Gaúcha',
      destinoCidade: 'Gramado',
      destinoUf: 'RS',
      dataInicio: '2027-05-01',
      dataFim: '2027-05-03',
      capacidade: 20,
      precoTitular: 900,
      precoAcompanhante: 700,
    });
  return res.body.viagem as { id: string };
}

function lancar(token: string, viagemId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/viagens/${viagemId}/despesas`)
    .set('Authorization', `Bearer ${token}`)
    .send({ dataDespesa: '2027-04-20', ...body });
}

afterAll(async () => {
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.despesa.deleteMany({ where: { tenantId } });
    await adminClient.viagem.deleteMany({ where: { tenantId } });
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

describe('Despesas: lançamento, total e resumo por categoria', () => {
  it('lança despesas e devolve total + total por categoria, refletindo nos agregados da viagem', async () => {
    const { token } = await criarTenantComAdmin();
    const viagem = await criarViagem(token);

    expect((await lancar(token, viagem.id, { categoria: 'Hotel', descricao: 'Hotel 2 noites', valor: 1200 })).status).toBe(201);
    expect((await lancar(token, viagem.id, { categoria: 'Ingressos', descricao: 'Snowland', valor: 450.5 })).status).toBe(201);
    expect((await lancar(token, viagem.id, { categoria: 'Hotel', descricao: 'Taxa extra', valor: 100 })).status).toBe(201);

    const lista = await request(app).get(`/viagens/${viagem.id}/despesas`).set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.despesas).toHaveLength(3);
    expect(lista.body.total).toBe('1750.5');
    expect(lista.body.totalPorCategoria).toEqual([
      { categoria: 'Hotel', total: '1300' },
      { categoria: 'Ingressos', total: '450.5' },
    ]);

    const detalhe = await request(app).get(`/viagens/${viagem.id}`).set('Authorization', `Bearer ${token}`);
    expect(detalhe.body.viagem.agregados.totalDespesas).toBe('1750.5');
  });

  it('rejeita categoria fora da lista do tenant e valor não positivo', async () => {
    const { token } = await criarTenantComAdmin();
    const viagem = await criarViagem(token);

    const categoriaInvalida = await lancar(token, viagem.id, { categoria: 'Cassino', descricao: 'x', valor: 10 });
    expect(categoriaInvalida.status).toBe(400);
    expect(categoriaInvalida.body.error.code).toBe('CATEGORIA_DESPESA_INVALIDA');

    const valorZero = await lancar(token, viagem.id, { categoria: 'Hotel', descricao: 'x', valor: 0 });
    expect(valorZero.status).toBe(400);
  });

  it('GET /despesas/categorias devolve as categorias configuradas (inclusive pro operador)', async () => {
    const { token } = await criarTenantComAdmin();
    const operador = await criarOperadorLogado(token);
    const res = await request(app).get('/despesas/categorias').set('Authorization', `Bearer ${operador}`);
    expect(res.status).toBe(200);
    expect(res.body.categoriasDespesa).toContain('Hotel');
  });
});

describe('Despesas: edição, exclusão e auditoria', () => {
  it('edita e exclui, gravando audit_log em create/update/delete', async () => {
    const { tenantId, token } = await criarTenantComAdmin();
    const viagem = await criarViagem(token);
    const criada = await lancar(token, viagem.id, { categoria: 'Seguro', descricao: 'Seguro grupo', valor: 300 });
    const id = criada.body.despesa.id;

    const editada = await request(app)
      .patch(`/despesas/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 350, descricao: 'Seguro grupo (ajustado)' });
    expect(editada.status).toBe(200);
    expect(editada.body.despesa.valor).toBe('350');

    const trocaInvalida = await request(app)
      .patch(`/despesas/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoria: 'Cassino' });
    expect(trocaInvalida.status).toBe(400);

    const excluida = await request(app).delete(`/despesas/${id}`).set('Authorization', `Bearer ${token}`);
    expect(excluida.status).toBe(204);

    const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
    const logs = await adminClient.auditLog.findMany({ where: { tenantId, entidade: 'despesa', entidadeId: id } });
    await adminClient.$disconnect();
    expect(logs.map((l) => l.acao).sort()).toEqual(['create', 'delete', 'update']);
  });

  it('excluir viagem em planejamento leva junto as despesas', async () => {
    const { token } = await criarTenantComAdmin();
    const viagem = await criarViagem(token);
    await lancar(token, viagem.id, { categoria: 'Outros', descricao: 'Reserva', valor: 50 });

    const res = await request(app).delete(`/viagens/${viagem.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe('Despesas: isolamento entre tenants', () => {
  it('tenant B recebe 404 ao listar, lançar, editar ou excluir despesas do tenant A', async () => {
    const a = await criarTenantComAdmin();
    const b = await criarTenantComAdmin();
    const viagemA = await criarViagem(a.token);
    const despesaA = await lancar(a.token, viagemA.id, { categoria: 'Hotel', descricao: 'Hotel', valor: 100 });
    const id = despesaA.body.despesa.id;

    const listar = await request(app).get(`/viagens/${viagemA.id}/despesas`).set('Authorization', `Bearer ${b.token}`);
    expect(listar.status).toBe(404);

    const lancarB = await lancar(b.token, viagemA.id, { categoria: 'Hotel', descricao: 'invasão', valor: 1 });
    expect(lancarB.status).toBe(404);

    const editar = await request(app)
      .patch(`/despesas/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ valor: 1 });
    expect(editar.status).toBe(404);

    const excluir = await request(app).delete(`/despesas/${id}`).set('Authorization', `Bearer ${b.token}`);
    expect(excluir.status).toBe(404);

    const aindaLa = await request(app).get(`/viagens/${viagemA.id}/despesas`).set('Authorization', `Bearer ${a.token}`);
    expect(aindaLa.body.total).toBe('100');
  });
});
