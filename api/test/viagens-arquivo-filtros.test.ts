import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const createdTenantIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Arquivo ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-arq-${suffix}@teste-arquivo.com`,
      senha: `SenhaForte-${suffix}-9x`,
      aceiteTermos: true,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return res.body.accessToken as string;
}

async function criarViagem(token: string, nome: string, dataInicio: string, dataFim: string) {
  const res = await request(app)
    .post('/viagens')
    .set(auth(token))
    .send({ nome, destinoCidade: 'Urubici', destinoUf: 'SC', dataInicio, dataFim, capacidade: 10, precoTitular: 300 });
  return res.body.viagem.id as string;
}

async function mudarStatus(token: string, id: string, status: string) {
  return request(app).patch(`/viagens/${id}/status`).set(auth(token)).send({ status });
}

async function concluir(token: string, id: string) {
  for (const s of ['inscricoes', 'confirmada', 'concluida']) await mudarStatus(token, id, s);
}

const nomes = (res: request.Response) => res.body.viagens.map((v: { nome: string }) => v.nome).sort();

afterAll(async () => {
  const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await admin.viagemHotel.deleteMany({ where: { tenantId } });
    await admin.viagem.deleteMany({ where: { tenantId } });
    await admin.refreshToken.deleteMany({ where: { tenantId } });
    await admin.auditLog.deleteMany({ where: { tenantId } });
    await admin.user.deleteMany({ where: { tenantId } });
    await admin.tenantSettings.deleteMany({ where: { tenantId } });
    await admin.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
  await admin.$disconnect();
  await prisma.$disconnect();
});

describe('Arquivar viagem', () => {
  it('só arquiva viagem concluída, permite desarquivar e tira da listagem padrão e da visão geral', async () => {
    const token = await criarTenant();
    const passada = await criarViagem(token, 'Passada', '2026-01-10', '2026-01-12');
    const futura = await criarViagem(token, 'Futura', '2027-06-10', '2027-06-12');

    expect((await mudarStatus(token, futura, 'arquivada')).status).toBe(400); // planejamento → arquivada

    await concluir(token, passada);
    expect((await mudarStatus(token, passada, 'arquivada')).status).toBe(200);

    expect(nomes(await request(app).get('/viagens').set(auth(token)))).toEqual(['Futura']);
    expect(nomes(await request(app).get('/viagens').query({ incluirArquivadas: 'true' }).set(auth(token)))).toEqual([
      'Futura',
      'Passada',
    ]);
    expect(nomes(await request(app).get('/viagens').query({ status: 'arquivada' }).set(auth(token)))).toEqual(['Passada']);

    const dash = await request(app).get('/dashboard').set(auth(token));
    expect(dash.body.resultadoPorViagem.map((v: { nome: string }) => v.nome)).toEqual(['Futura']);

    expect((await mudarStatus(token, passada, 'concluida')).status).toBe(200); // desarquivar
    expect(nomes(await request(app).get('/viagens').set(auth(token)))).toEqual(['Futura', 'Passada']);
  });
});

describe('Filtro por período da viagem', () => {
  it('traz viagens que acontecem, ao menos em parte, dentro do intervalo', async () => {
    const token = await criarTenant();
    await criarViagem(token, 'Março', '2027-03-28', '2027-04-02'); // cruza o início de abril
    await criarViagem(token, 'Abril', '2027-04-10', '2027-04-12');
    await criarViagem(token, 'Maio', '2027-05-10', '2027-05-12');

    const abril = await request(app)
      .get('/viagens')
      .query({ dataInicio: '2027-04-01', dataFim: '2027-04-30' })
      .set(auth(token));
    expect(nomes(abril)).toEqual(['Abril', 'Março']);

    const aPartirDeMaio = await request(app).get('/viagens').query({ dataInicio: '2027-05-01' }).set(auth(token));
    expect(nomes(aPartirDeMaio)).toEqual(['Maio']);
  });
});

describe('Datas da viagem e do hotel', () => {
  it('recusa data final anterior à inicial na criação, na edição parcial e no check-out do hotel', async () => {
    const token = await criarTenant();

    const invalida = await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ nome: 'Invertida', destinoCidade: 'SP', destinoUf: 'SP', dataInicio: '2027-11-22', dataFim: '2027-11-15', capacidade: 6, precoTitular: 1 });
    expect(invalida.status).toBe(400);

    const mesmoDia = await criarViagem(token, 'Bate-volta', '2027-11-22', '2027-11-22');
    expect(mesmoDia).toBeTruthy();

    const id = await criarViagem(token, 'Ok', '2027-11-15', '2027-11-22');
    const soFim = await request(app).patch(`/viagens/${id}`).set(auth(token)).send({ dataFim: '2027-11-10' });
    expect(soFim.status).toBe(400);
    expect(soFim.body.error.code).toBe('DATAS_INVALIDAS');

    const soInicio = await request(app).patch(`/viagens/${id}`).set(auth(token)).send({ dataInicio: '2027-11-30' });
    expect(soInicio.status).toBe(400);

    const hotel = await request(app)
      .post(`/viagens/${id}/hoteis`)
      .set(auth(token))
      .send({ nome: 'Hotel', checkIn: '2027-11-16', checkOut: '2027-11-15' });
    expect(hotel.status).toBe(400);
  });
});
