import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { MemoryStorageDriver, storage } from '../src/lib/storage.js';
import { emailService } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const memoria = storage as MemoryStorageDriver;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Uploads ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-up-${suffix}@teste-uploads.com`,
      senha: `SenhaForte-${suffix}-9x`,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return { tenantId: res.body.user.tenant.id as string, token: res.body.accessToken as string };
}

async function criarOperador(adminToken: string) {
  const email = `op-up-${randomUUID().slice(0, 8)}@teste-uploads.com`;
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

async function criarPagamento(token: string) {
  const v = await request(app)
    .post('/viagens')
    .set(auth(token))
    .send({
      nome: 'Uploads',
      destinoCidade: 'Curitiba',
      destinoUf: 'PR',
      dataInicio: '2027-08-01',
      dataFim: '2027-08-02',
      capacidade: 5,
      precoTitular: 100,
      precoAcompanhante: 50,
    });
  await request(app).patch(`/viagens/${v.body.viagem.id}/status`).set(auth(token)).send({ status: 'inscricoes' });
  const c = await request(app).post('/clientes').set(auth(token)).send({ nome: 'Cliente Upload', telefone: '41900000000' });
  const i = await request(app)
    .post(`/viagens/${v.body.viagem.id}/inscricoes`)
    .set(auth(token))
    .send({ clienteId: c.body.cliente.id, valorTotal: 100 });
  const p = await request(app)
    .post(`/inscricoes/${i.body.inscricao.id}/pagamentos`)
    .set(auth(token))
    .send({ valor: 50, forma: 'Pix', dataPagamento: '2027-07-01' });
  return { pagamentoId: p.body.pagamento.id as string, inscricaoId: i.body.inscricao.id as string };
}

function enviar(token: string, finalidade: string, entidadeId: string | undefined, arquivo: Buffer, nome = 'arquivo.pdf') {
  const req = request(app).post('/uploads').set(auth(token)).field('finalidade', finalidade);
  if (entidadeId) req.field('entidadeId', entidadeId);
  return req.attach('arquivo', arquivo, nome);
}

afterAll(async () => {
  const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await admin.pagamento.deleteMany({ where: { tenantId } });
    await admin.inscricao.deleteMany({ where: { tenantId } });
    await admin.despesa.deleteMany({ where: { tenantId } });
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

describe('Upload de comprovante de pagamento', () => {
  it('sobe PDF, vincula ao pagamento, assina URL e remove o arquivo ao excluir o pagamento', async () => {
    const { tenantId, token } = await criarTenant();
    const { pagamentoId, inscricaoId } = await criarPagamento(token);

    const up = await enviar(token, 'comprovante_pagamento', pagamentoId, PDF);
    expect(up.status).toBe(201);
    expect(up.body.referencia).toMatch(new RegExp(`^comprovantes/${tenantId}/pagamento/[0-9a-f-]+\\.pdf$`));
    expect(memoria.arquivos.has(up.body.referencia)).toBe(true);

    const lista = await request(app).get(`/inscricoes/${inscricaoId}/pagamentos`).set(auth(token));
    expect(lista.body.pagamentos[0].comprovanteUrl).toBe(up.body.referencia);

    const assinada = await request(app)
      .get('/uploads/signed-url')
      .query({ path: up.body.referencia })
      .set(auth(token));
    expect(assinada.status).toBe(200);
    expect(assinada.body.expiraEmSegundos).toBe(600);

    const del = await request(app).delete(`/pagamentos/${pagamentoId}`).set(auth(token)).send({ motivo: 'teste' });
    expect(del.status).toBe(204);
    expect(memoria.arquivos.has(up.body.referencia)).toBe(false);
  });

  it('substituir comprovante apaga o arquivo anterior; DELETE /uploads desvincula', async () => {
    const { token } = await criarTenant();
    const { pagamentoId } = await criarPagamento(token);
    const primeiro = await enviar(token, 'comprovante_pagamento', pagamentoId, PDF);
    const segundo = await enviar(token, 'comprovante_pagamento', pagamentoId, PNG, 'foto.png');
    expect(segundo.body.referencia).toMatch(/\.png$/);
    expect(memoria.arquivos.has(primeiro.body.referencia)).toBe(false);

    const rem = await request(app)
      .delete('/uploads')
      .set(auth(token))
      .send({ finalidade: 'comprovante_pagamento', entidadeId: pagamentoId });
    expect(rem.status).toBe(204);
    expect(memoria.arquivos.has(segundo.body.referencia)).toBe(false);
  });

  it('rejeita tipo não suportado (pelos bytes, não pela extensão) e arquivo > 5 MB', async () => {
    const { token } = await criarTenant();
    const { pagamentoId } = await criarPagamento(token);

    const disfarcado = await enviar(token, 'comprovante_pagamento', pagamentoId, Buffer.from('MZ executável'), 'nota.pdf');
    expect(disfarcado.status).toBe(400);
    expect(disfarcado.body.error.code).toBe('TIPO_NAO_SUPORTADO');

    const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await enviar(token, 'comprovante_pagamento', pagamentoId, grande);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ARQUIVO_GRANDE');
  });
});

describe('Logo do tenant', () => {
  it('admin sobe PNG; PDF é recusado; operador não pode', async () => {
    const { tenantId, token } = await criarTenant();
    const res = await enviar(token, 'logo', undefined, PNG, 'logo.png');
    expect(res.status).toBe(201);
    expect(res.body.referencia).toMatch(new RegExp(`^logos/${tenantId}/logo/`));

    const cfg = await request(app).get('/configuracoes').set(auth(token));
    expect(cfg.body.configuracoes.logoUrl).toBe(res.body.referencia);

    expect((await enviar(token, 'logo', undefined, PDF)).status).toBe(400);

    const operador = await criarOperador(token);
    expect((await enviar(operador, 'logo', undefined, PNG, 'logo.png')).status).toBe(403);
  });
});

describe('Isolamento entre tenants', () => {
  it('tenant B não obtém URL assinada nem anexa arquivo em registro do tenant A (404)', async () => {
    const a = await criarTenant();
    const b = await criarTenant();
    const { pagamentoId } = await criarPagamento(a.token);
    const up = await enviar(a.token, 'comprovante_pagamento', pagamentoId, PDF);

    const assinada = await request(app).get('/uploads/signed-url').query({ path: up.body.referencia }).set(auth(b.token));
    expect(assinada.status).toBe(404);

    const traversal = await request(app)
      .get('/uploads/signed-url')
      .query({ path: `comprovantes/${b.tenantId}/../${a.tenantId}/pagamento/x.pdf` })
      .set(auth(b.token));
    expect(traversal.status).toBe(404);

    const anexar = await enviar(b.token, 'comprovante_pagamento', pagamentoId, PDF);
    expect(anexar.status).toBe(404);

    const remover = await request(app)
      .delete('/uploads')
      .set(auth(b.token))
      .send({ finalidade: 'comprovante_pagamento', entidadeId: pagamentoId });
    expect(remover.status).toBe(404);
    expect(memoria.arquivos.has(up.body.referencia)).toBe(true);
  });
});
