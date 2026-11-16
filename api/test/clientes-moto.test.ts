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
      nomeFantasia: `Empresa Moto ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-moto-${suffix}@teste-moto.com`,
      senha: `SenhaForte-${suffix}-9x`,
      aceiteTermos: true,
    });
  createdTenantIds.push(res.body.user.tenant.id);
  return res.body.accessToken as string;
}


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

describe('Cliente: moto e data de nascimento', () => {
  it('grava marca/modelo da moto e nascimento na criação, edita e limpa com null', async () => {
    const token = await criarTenant();
    const criado = await request(app)
      .post('/clientes')
      .set(auth(token))
      .send({ nome: 'Piloto', telefone: '47999990000', dataNascimento: '1985-03-20', motoMarca: 'Honda', motoModelo: 'CB 500X' });
    expect(criado.status).toBe(201);
    expect(criado.body.cliente).toMatchObject({ motoMarca: 'Honda', motoModelo: 'CB 500X' });
    expect(criado.body.cliente.dataNascimento.slice(0, 10)).toBe('1985-03-20');

    const lista = await request(app).get('/clientes').set(auth(token));
    expect(lista.body.clientes[0]).toMatchObject({ motoMarca: 'Honda', motoModelo: 'CB 500X' });

    const editado = await request(app)
      .patch(`/clientes/${criado.body.cliente.id}`)
      .set(auth(token))
      .send({ motoMarca: 'BMW', motoModelo: 'R 1250 GS' });
    expect(editado.body.cliente).toMatchObject({ motoMarca: 'BMW', motoModelo: 'R 1250 GS' });

    const limpo = await request(app)
      .patch(`/clientes/${criado.body.cliente.id}`)
      .set(auth(token))
      .send({ motoMarca: null, motoModelo: null, dataNascimento: null });
    expect(limpo.body.cliente).toMatchObject({ motoMarca: null, motoModelo: null, dataNascimento: null });

    const futuro = await request(app)
      .post('/clientes')
      .set(auth(token))
      .send({ nome: 'Futuro', telefone: '47999990000', dataNascimento: '2999-01-01' });
    expect(futuro.status).toBe(400);
  });
});
