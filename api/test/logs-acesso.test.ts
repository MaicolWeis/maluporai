import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { logger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';
import { emailService } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Logs ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-logs-${suffix}@teste-logs.com`,
      senha: `SenhaForte-${suffix}-9x`,
      aceiteTermos: true,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

afterAll(async () => {
  const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
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

describe('Log de acesso por requisição', () => {
  it('registra usuário, empresa, rota em modelo (sem IDs), status e duração — sem dados da requisição', async () => {
    const { token, userId } = await criarTenant();
    const cliente = await request(app)
      .post('/clientes')
      .set(auth(token))
      .send({ nome: 'Cliente Log', telefone: '47999990000' });
    const id = cliente.body.cliente.id as string;

    const spy = vi.spyOn(logger, 'info');
    await request(app).get(`/clientes/${id}`).set(auth(token)).expect(200);
    await new Promise((r) => setTimeout(r, 20));
    const acessos = spy.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((o) => o?.tipo === 'acesso');
    spy.mockRestore();

    const linha = acessos.find((a) => a.rota === '/clientes/:id');
    expect(linha).toMatchObject({ usuario: userId, metodo: 'GET', status: 200 });
    expect(typeof linha!.ms).toBe('number');
    expect(JSON.stringify(acessos)).not.toContain(id);
    expect(JSON.stringify(acessos)).not.toContain('Bearer');
  });

  it('não registra o healthcheck', async () => {
    const spy = vi.spyOn(logger, 'info');
    await request(app).get('/health');
    await new Promise((r) => setTimeout(r, 20));
    const acessos = spy.mock.calls.filter((c) => (c[0] as Record<string, unknown>)?.tipo === 'acesso');
    spy.mockRestore();
    expect(acessos).toHaveLength(0);
  });
});

describe('Auditoria: consulta de ficha e IP da ativação', () => {
  it('abrir a ficha do cliente gera "consulta" auditada com IP', async () => {
    const { token, userId } = await criarTenant();
    const cliente = await request(app)
      .post('/clientes')
      .set(auth(token))
      .send({ nome: 'Cliente Consulta', telefone: '47999990001' });
    await request(app).get(`/clientes/${cliente.body.cliente.id}`).set(auth(token)).expect(200);

    const trilha = await request(app).get('/auditoria').query({ acao: 'consulta' }).set(auth(token));
    expect(trilha.status).toBe(200);
    expect(trilha.body.itens).toHaveLength(1);
    expect(trilha.body.itens[0]).toMatchObject({ entidade: 'cliente', userId, entidadeId: cliente.body.cliente.id });
    expect(trilha.body.itens[0].ip).toBeTruthy();
  });

  it('ativação de conta convidada fica registrada com IP', async () => {
    const { token } = await criarTenant();
    let html = '';
    const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
      html = msg.html;
    });
    await request(app)
      .post('/usuarios/convites')
      .set(auth(token))
      .send({ nome: 'Convidada', email: `convidada-${randomUUID().slice(0, 6)}@teste-logs.com`, papel: 'operador' });
    spy.mockRestore();
    const conviteToken = html.match(/\/ativar-conta\/([^"<\s]+)/)![1];
    await request(app)
      .post('/auth/ativar-conta')
      .send({ token: conviteToken, senha: `SenhaNova-${randomUUID().slice(0, 6)}-9x` })
      .expect(200);

    const trilha = await request(app).get('/auditoria').query({ entidade: 'user', acao: 'update' }).set(auth(token));
    const ativacao = trilha.body.itens.find((i: { dados: { evento?: string } | null }) => i.dados?.evento === 'ativacao_conta');
    expect(ativacao).toBeTruthy();
    expect(ativacao.ip).toBeTruthy();
  });
});
