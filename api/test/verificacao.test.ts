import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { aguardarFila } from '../src/services/geocodificacao.service.js';
import { executarVerificacao, montarEmail } from '../src/services/verificacao.service.js';
import type { EmailMessage } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarTenant() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/auth/signup')
    .send({
      nomeFantasia: `Empresa Verif ${suffix}`,
      documento: '12345678000190',
      nome: `Admin ${suffix}`,
      email: `admin-verif-${suffix}@teste-verif.com`,
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

describe('Verificação diária', () => {
  it('resume a atividade por empresa (logins por usuário, ações) e monta o e-mail sem dados de clientes', async () => {
    const token = await criarTenant();
    await request(app)
      .post('/clientes')
      .set(auth(token))
      .send({ nome: 'Cliente Sigiloso', telefone: '47999990000' });

    const enviados: EmailMessage[] = [];
    const relatorio = await executarVerificacao(new Date(), { send: async (m) => void enviados.push(m) });

    const banco = relatorio.checagens.find((c) => c.nome === 'Banco de dados');
    expect(banco?.ok).toBe(true);
    const empresa = relatorio.empresas.find((e) => e.empresa.startsWith('Empresa Verif'));
    expect(empresa).toBeTruthy();
    expect(empresa!.clientes).toBe(1);
    expect(empresa!.acoes.create).toBeGreaterThanOrEqual(1);

    const { subject, html } = montarEmail(relatorio);
    expect(subject).toContain('verificação diária');
    expect(html).toContain('Empresa Verif');
    expect(html).not.toContain('Cliente Sigiloso');
    // Sem RELATORIO_EMAIL configurado nos testes, nada é enviado.
    expect(enviados).toHaveLength(0);
  });
});
