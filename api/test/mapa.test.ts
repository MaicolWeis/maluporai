import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { aguardarFila } from '../src/services/geocodificacao.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Mapa ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-mapa-${suffix}@teste-mapa.com`,
      senha: `SenhaForte-${suffix}-9x`,
      aceiteTermos: true,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return res.body.accessToken as string;
}

const viagemBase = {
  nome: 'Viagem',
  dataInicio: '2027-05-01',
  dataFim: '2027-05-05',
  capacidade: 10,
  precoTitular: 1000,
};

afterAll(async () => {
  await aguardarFila();
  const admin = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
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

describe('País de destino da viagem', () => {
  it('padrão Brasil exige UF; fora do Brasil a UF é opcional e livre', async () => {
    const token = await criarTenant();

    const semUf = await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ ...viagemBase, destinoCidade: 'Gramado' });
    expect(semUf.status).toBe(400);

    const br = await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ ...viagemBase, destinoCidade: 'Gramado', destinoUf: 'rs' });
    expect(br.status).toBe(201);
    expect(br.body.viagem).toMatchObject({ destinoPais: 'BR', destinoUf: 'RS' });

    const ar = await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ ...viagemBase, destinoCidade: 'Bariloche', destinoUf: 'Río Negro', destinoPais: 'ar' });
    expect(ar.status).toBe(201);
    expect(ar.body.viagem).toMatchObject({ destinoPais: 'AR', destinoUf: 'Río Negro' });

    const cl = await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ ...viagemBase, destinoCidade: 'Santiago', destinoPais: 'CL' });
    expect(cl.status).toBe(201);
    expect(cl.body.viagem.destinoUf).toBeNull();

    // Mudar para Brasil sem UF é recusado
    const paraBr = await request(app).patch(`/viagens/${cl.body.viagem.id}`).set(auth(token)).send({ destinoPais: 'BR' });
    expect(paraBr.status).toBe(400);
  });
});

describe('GET /mapa', () => {
  it('agrupa clientes por cidade (só contagem) e lista destinos com coordenadas, isolado por empresa', async () => {
    const token = await criarTenant();
    const outro = await criarTenant();
    for (const [nome, cidade, uf] of [
      ['Ana', 'Blumenau', 'SC'],
      ['Bia', 'blumenau ', 'sc'],
      ['Caio', 'Joinville', 'SC'],
      ['Duda', '', undefined],
    ] as [string, string, string | undefined][]) {
      await request(app)
        .post('/clientes')
        .set(auth(token))
        .send({ nome, telefone: '47999990000', ...(cidade && { cidade }), ...(uf && { uf }) });
    }
    await request(app)
      .post('/viagens')
      .set(auth(token))
      .send({ ...viagemBase, destinoCidade: 'Cusco', destinoPais: 'PE' });
    await request(app).post('/clientes').set(auth(outro)).send({ nome: 'Outro', telefone: '1', cidade: 'Recife', uf: 'PE' });

    await request(app).get('/mapa').set(auth(token));
    await aguardarFila();
    const res = await request(app).get('/mapa').set(auth(token));
    expect(res.status).toBe(200);

    const blumenau = res.body.clientes.find((c: { cidade: string }) => c.cidade.toLowerCase() === 'blumenau');
    expect(blumenau.total).toBe(2);
    expect(blumenau.posicao).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(res.body.clientes).toHaveLength(2);
    expect(JSON.stringify(res.body.clientes)).not.toContain('Ana');
    expect(res.body.clientesSemCidade).toBe(1);
    expect(res.body.destinos).toHaveLength(1);
    expect(res.body.destinos[0]).toMatchObject({ cidade: 'Cusco', pais: 'PE' });
    expect(res.body.destinos[0].posicao).not.toBeNull();
    expect(res.body.pendentes).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain('Recife');
  });
});
