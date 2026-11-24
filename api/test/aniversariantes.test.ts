import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { aguardarFila } from '../src/services/geocodificacao.service.js';
import { hojeBrasil } from '../src/services/financeiro.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Aniver ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-aniver-${suffix}@teste-aniver.com`,
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

const pad = (n: number) => String(n).padStart(2, '0');

describe('GET /dashboard/aniversariantes', () => {
  it('lista os aniversariantes do mês em ordem de dia, com idade e destaque de hoje, isolado por empresa', async () => {
    const token = await criarTenant();
    const outro = await criarTenant();
    const hoje = hojeBrasil();
    const mes = hoje.getUTCMonth() + 1;
    const diaHoje = hoje.getUTCDate();
    const outroMes = (mes % 12) + 1;

    const criar = (t: string, nome: string, nasc?: string) =>
      request(app)
        .post('/clientes')
        .set(auth(t))
        .send({ nome, telefone: '47999990000', ...(nasc && { dataNascimento: nasc }) });

    await criar(token, 'Hoje Silva', `1990-${pad(mes)}-${pad(diaHoje)}`);
    await criar(token, 'Primeiro Dia', `2000-${pad(mes)}-01`);
    await criar(token, 'Outro Mes', `1980-${pad(outroMes)}-10`);
    await criar(token, 'Sem Data');
    await criar(outro, 'Empresa B', `1995-${pad(mes)}-05`);

    const res = await request(app).get('/dashboard/aniversariantes').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.mes).toBe(mes);
    const nomes = res.body.aniversariantes.map((a: { nome: string }) => a.nome);
    expect(nomes).toContain('Hoje Silva');
    expect(nomes).toContain('Primeiro Dia');
    expect(nomes).not.toContain('Outro Mes');
    expect(nomes).not.toContain('Sem Data');
    expect(nomes).not.toContain('Empresa B');
    expect(res.body.aniversariantes[0].dia).toBe(1);

    const aniversarianteHoje = res.body.aniversariantes.find((a: { nome: string }) => a.nome === 'Hoje Silva');
    expect(aniversarianteHoje).toMatchObject({ hoje: true, idade: hoje.getUTCFullYear() - 1990 });

    const proximo = await request(app).get('/dashboard/aniversariantes').query({ mes: outroMes }).set(auth(token));
    expect(proximo.body.aniversariantes.map((a: { nome: string }) => a.nome)).toEqual(['Outro Mes']);

    const invalido = await request(app).get('/dashboard/aniversariantes').query({ mes: 13 }).set(auth(token));
    expect(invalido.status).toBe(400);
  });
});
