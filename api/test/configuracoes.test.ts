import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenant-context.js';
import { emailService } from '../src/services/email.service.js';

const app = createApp();
const createdTenantIds: string[] = [];

function signupPayload(suffix: string) {
  return {
    nomeFantasia: `Empresa Config ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-config-${suffix}@teste-config.com`,
    senha: `SenhaForte-${suffix}-9x`,
  };
}

async function criarTenantComAdmin() {
  const suffix = randomUUID().slice(0, 8);
  const res = await request(app).post('/auth/signup').send(signupPayload(suffix));
  createdTenantIds.push(res.body.user.tenant.id);
  return {
    tenantId: res.body.user.tenant.id as string,
    adminAccessToken: res.body.accessToken as string,
  };
}

function extractActivationToken(html: string): string {
  const match = html.match(/\/ativar-conta\/([^"<\s]+)/);
  if (!match) throw new Error('Token de ativação não encontrado no e-mail simulado');
  return match[1];
}

/** Convida um operador, ativa e loga — reaproveita o fluxo do P3. */
async function criarOperadorLogado(adminAccessToken: string): Promise<string> {
  const email = `operador-config-${randomUUID().slice(0, 8)}@teste-config.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });

  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: 'Operador Config', email, papel: 'operador' });
  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  return loginRes.body.accessToken;
}

afterAll(async () => {
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.pagamento.deleteMany({ where: { tenantId } });
    await adminClient.inscricao.deleteMany({ where: { tenantId } });
    await adminClient.viagem.deleteMany({ where: { tenantId } });
    await adminClient.cliente.deleteMany({ where: { tenantId } });
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

describe('GET /configuracoes', () => {
  it('retorna tenant + tenant_settings recém-criados com os defaults do signup', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const res = await request(app)
      .get('/configuracoes')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tenant.nomeFantasia).toMatch(/^Empresa Config/);
    expect(res.body.configuracoes.formasPagamento).toEqual(['Pix', 'Cartão', 'Dinheiro', 'Transferência']);
    expect(res.body.configuracoes.prazoRetencaoDadosMeses).toBe(60);
  });
});

describe('Regra: operador não acessa /configuracoes', () => {
  it('responde 403 em GET e PATCH', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);

    const getRes = await request(app)
      .get('/configuracoes')
      .set('Authorization', `Bearer ${operadorToken}`);
    const patchRes = await request(app)
      .patch('/configuracoes/empresa')
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ telefone: '11999998888' });

    expect(getRes.status).toBe(403);
    expect(patchRes.status).toBe(403);
  });
});

describe('PATCH parcial não apaga campos não enviados', () => {
  it('atualiza só o campo enviado em /configuracoes/preferencias', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const antes = await request(app)
      .get('/configuracoes')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    const categoriasAntes = antes.body.configuracoes.categoriasDespesa;
    const prazoAntes = antes.body.configuracoes.prazoRetencaoDadosMeses;

    const patchRes = await request(app)
      .patch('/configuracoes/preferencias')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ corPrimaria: '#111111' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.configuracoes.corPrimaria).toBe('#111111');

    const depois = await request(app)
      .get('/configuracoes')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(depois.body.configuracoes.categoriasDespesa).toEqual(categoriasAntes);
    expect(depois.body.configuracoes.prazoRetencaoDadosMeses).toBe(prazoAntes);
    expect(depois.body.configuracoes.formasPagamento).toEqual(['Pix', 'Cartão', 'Dinheiro', 'Transferência']);
  });

  it('atualiza só o campo enviado em /configuracoes/empresa', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const antes = await request(app)
      .get('/configuracoes')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    const nomeFantasiaAntes = antes.body.tenant.nomeFantasia;

    const patchRes = await request(app)
      .patch('/configuracoes/empresa')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ telefone: '11988887777' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.tenant.telefone).toBe('11988887777');
    expect(patchRes.body.tenant.nomeFantasia).toBe(nomeFantasiaAntes);
  });
});

describe('Regra: prazo_retencao_dados_meses mínimo de 12 meses', () => {
  it('rejeita valor abaixo de 12', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const res = await request(app)
      .patch('/configuracoes/preferencias')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ prazoRetencaoDadosMeses: 6 });

    expect(res.status).toBe(400);
  });

  it('aceita 12 (limite exato)', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const res = await request(app)
      .patch('/configuracoes/preferencias')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ prazoRetencaoDadosMeses: 12 });

    expect(res.status).toBe(200);
    expect(res.body.configuracoes.prazoRetencaoDadosMeses).toBe(12);
  });
});

describe('Regra: remover forma de pagamento em uso não altera lançamentos históricos', () => {
  it('mantém o forma do pagamento já registrado após remover a opção das preferências', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();

    const pagamentoId = await runWithTenant(tenantId, async () => {
      const cliente = await prisma.cliente.create({ data: { nome: 'Cliente Histórico', telefone: '11900000000' } });
      const viagem = await prisma.viagem.create({
        data: {
          nome: 'Viagem Histórica',
          destinoCidade: 'Gramado',
          destinoUf: 'RS',
          dataInicio: new Date('2027-01-10'),
          dataFim: new Date('2027-01-15'),
          capacidade: 40,
          precoTitular: 1500,
        },
      });
      const inscricao = await prisma.inscricao.create({
        data: { viagemId: viagem.id, clienteId: cliente.id, valorTotal: 1500 },
      });
      const pagamento = await prisma.pagamento.create({
        data: {
          inscricaoId: inscricao.id,
          valor: 500,
          forma: 'pix',
          dataPagamento: new Date('2027-01-01'),
        },
      });
      return pagamento.id;
    });

    // Remove "Pix" das formas de pagamento oferecidas pro tenant.
    const patchRes = await request(app)
      .patch('/configuracoes/preferencias')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ formasPagamento: ['Cartão', 'Dinheiro', 'Transferência'] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.configuracoes.formasPagamento).toEqual(['Cartão', 'Dinheiro', 'Transferência']);

    // O lançamento histórico continua com forma "pix", intocado.
    const pagamento = await runWithTenant(tenantId, () =>
      prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } }),
    );
    expect(pagamento.forma).toBe('pix');
  });
});
