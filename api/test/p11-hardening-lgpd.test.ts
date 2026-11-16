import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { TERMOS_VERSAO } from '../src/lib/termos.js';
import { emailService } from '../src/services/email.service.js';
import { hojeBrasil } from '../src/services/financeiro.service.js';
import { executarRetencao } from '../src/services/retencao.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function payload(suffix: string) {
  return {
    nomeFantasia: `Empresa P11 ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-p11-${suffix}@teste-p11.com`,
    senha: `SenhaForte-${suffix}-9x`,
    aceiteTermos: true,
  };
}

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app).post('/auth/signup').send(payload(suffix));
  createdTenantIds.push(res.body.user.tenant.id);
  return {
    tenantId: res.body.user.tenant.id as string,
    userId: res.body.user.id as string,
    email: payload(suffix).email,
    token: res.body.accessToken as string,
  };
}

async function criarOperador(adminToken: string) {
  const email = `op-p11-${randomUUID().slice(0, 8)}@teste-p11.com`;
  let html = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (m) => {
    html = m.html;
  });
  await request(app).post('/usuarios/convites').set(auth(adminToken)).send({ nome: 'Op', email, papel: 'operador' });
  spy.mockRestore();
  const token = html.match(/\/ativar-conta\/([^"<\s]+)/)?.[1];
  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  return (await request(app).post('/auth/login').send({ email, senha })).body.accessToken as string;
}

async function criarViagem(token: string, capacidade: number, status: 'planejamento' | 'inscricoes' = 'inscricoes') {
  const v = await request(app)
    .post('/viagens')
    .set(auth(token))
    .send({
      nome: 'Viagem P11',
      destinoCidade: 'Bonito',
      destinoUf: 'MS',
      dataInicio: '2027-09-01',
      dataFim: '2027-09-05',
      capacidade,
      precoTitular: 100,
      precoAcompanhante: 50,
    });
  if (status === 'inscricoes') {
    await request(app).patch(`/viagens/${v.body.viagem.id}/status`).set(auth(token)).send({ status: 'inscricoes' });
  }
  return v.body.viagem.id as string;
}

async function criarCliente(token: string, nome = `Cliente ${randomUUID().slice(0, 6)}`) {
  const c = await request(app).post('/clientes').set(auth(token)).send({ nome, telefone: '67900000000' });
  return c.body.cliente.id as string;
}

afterAll(async () => {
  for (const tenantId of createdTenantIds) {
    await admin.pagamento.deleteMany({ where: { tenantId } });
    await admin.inscricao.deleteMany({ where: { tenantId } });
    await admin.viagemHotel.deleteMany({ where: { tenantId } });
    await admin.viagem.deleteMany({ where: { tenantId } });
    await admin.cliente.deleteMany({ where: { tenantId } });
    await admin.activationToken.deleteMany({ where: { tenantId } });
    await admin.refreshToken.deleteMany({ where: { tenantId } });
    await admin.auditLog.deleteMany({ where: { tenantId } });
    await admin.user.deleteMany({ where: { tenantId } });
    await admin.tenantSettings.deleteMany({ where: { tenantId } });
    await admin.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
  await admin.$disconnect();
  await prisma.$disconnect();
});

describe('Aceite de termos no signup', () => {
  it('rejeita signup sem aceite e grava versão + data quando aceito', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { aceiteTermos: _omitido, ...semAceite } = payload(suffix);
    const recusado = await request(app).post('/auth/signup').send(semAceite);
    expect(recusado.status).toBe(400);

    const t = await criarTenant();
    const user = await admin.user.findUnique({ where: { id: t.userId } });
    expect(user?.termosVersao).toBe(TERMOS_VERSAO);
    expect(user?.termosAceitosEm).toBeInstanceOf(Date);
  });
});

describe('Capacidade garantida no banco (lock por viagem)', () => {
  it('duas inscrições simultâneas para a última vaga: só uma passa', async () => {
    const { token } = await criarTenant();
    const viagemId = await criarViagem(token, 1);
    const [c1, c2] = await Promise.all([criarCliente(token), criarCliente(token)]);

    const respostas = await Promise.all(
      [c1, c2].map((clienteId) =>
        request(app).post(`/viagens/${viagemId}/inscricoes`).set(auth(token)).send({ clienteId }),
      ),
    );
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(respostas.find((r) => r.status === 400)?.body.error.code).toBe('CAPACIDADE_EXCEDIDA');

    const lista = await request(app).get(`/viagens/${viagemId}/inscricoes`).set(auth(token));
    expect(lista.body.inscricoes.filter((i: { status: string }) => i.status === 'confirmada')).toHaveLength(1);
  });

  it('adicionar acompanhante numa viagem lotada é barrado', async () => {
    const { token } = await criarTenant();
    const viagemId = await criarViagem(token, 1);
    const clienteId = await criarCliente(token);
    const insc = await request(app).post(`/viagens/${viagemId}/inscricoes`).set(auth(token)).send({ clienteId });
    const res = await request(app)
      .patch(`/inscricoes/${insc.body.inscricao.id}`)
      .set(auth(token))
      .send({ levaAcompanhante: true, nomeAcompanhante: 'Garupa' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CAPACIDADE_EXCEDIDA');
  });
});

describe('Auditoria', () => {
  it('sub-recursos de viagem são auditados e GET /auditoria filtra, pagina e isola por tenant', async () => {
    const a = await criarTenant();
    const b = await criarTenant();
    const viagemId = await criarViagem(a.token, 10, 'planejamento');
    await request(app)
      .post(`/viagens/${viagemId}/hoteis`)
      .set(auth(a.token))
      .send({ nome: 'Hotel Rio Formoso', cidade: 'Bonito' });

    const res = await request(app).get('/auditoria').query({ entidade: 'viagem_hotel' }).set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.itens[0]).toMatchObject({ acao: 'create', entidade: 'viagem_hotel', usuarioNome: expect.any(String) });
    expect(res.body.filtros.entidades).toEqual(expect.arrayContaining(['viagem', 'viagem_hotel']));

    const paginado = await request(app).get('/auditoria').query({ pageSize: 1 }).set(auth(a.token));
    expect(paginado.body.itens).toHaveLength(1);
    expect(paginado.body.total).toBeGreaterThan(1);

    const deB = await request(app).get('/auditoria').query({ entidade: 'viagem_hotel' }).set(auth(b.token));
    expect(deB.body.total).toBe(0);

    const operador = await criarOperador(a.token);
    expect((await request(app).get('/auditoria').set(auth(operador))).status).toBe(403);
  });
});

describe('Rotina de retenção LGPD', () => {
  it('anonimiza só quem passou do prazo sem inscrição ativa e avisa o admin 30 dias antes', async () => {
    const { token, email } = await criarTenant();
    const vencido = await criarCliente(token, 'Cliente Vencido');
    const comViagem = await criarCliente(token, 'Cliente Com Viagem');
    const recente = await criarCliente(token, 'Cliente Recente');
    const quaseVencendo = await criarCliente(token, 'Cliente Quase');

    const viagemId = await criarViagem(token, 10);
    await request(app).post(`/viagens/${viagemId}/inscricoes`).set(auth(token)).send({ clienteId: comViagem });

    const hoje = hojeBrasil();
    const limite = new Date(hoje);
    limite.setUTCMonth(limite.getUTCMonth() - 60); // prazo padrão: 60 meses
    const muitoAntigo = new Date(limite.getTime() - 10 * 24 * 60 * 60 * 1000);
    const em30Dias = new Date(limite.getTime() + 30 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);

    await admin.$executeRaw`UPDATE clientes SET updated_at = ${muitoAntigo} WHERE id IN (${vencido}::uuid, ${comViagem}::uuid)`;
    await admin.$executeRaw`UPDATE clientes SET updated_at = ${em30Dias} WHERE id = ${quaseVencendo}::uuid`;

    const enviados: string[] = [];
    const spy = vi.spyOn(emailService, 'send').mockImplementation(async (m) => {
      if (m.to === email) enviados.push(m.subject);
    });
    await executarRetencao();
    spy.mockRestore();

    const clientes = await admin.cliente.findMany({ where: { id: { in: [vencido, comViagem, recente, quaseVencendo] } } });
    const porId = new Map(clientes.map((c) => [c.id, c]));
    expect(porId.get(vencido)?.anonimizadoEm).not.toBeNull();
    expect(porId.get(vencido)?.nome).toMatch(/^Cliente anonimizado/);
    expect(porId.get(comViagem)?.anonimizadoEm).toBeNull();
    expect(porId.get(recente)?.anonimizadoEm).toBeNull();
    expect(porId.get(quaseVencendo)?.anonimizadoEm).toBeNull();

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toContain('1 cliente(s)');

    const log = await admin.auditLog.findFirst({ where: { entidadeId: vencido, acao: 'anonimizacao' } });
    expect(log?.dadosDepois).toMatchObject({ motivo: 'retencao_automatica' });
  });
});
