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
    nomeFantasia: `Empresa Pagamentos ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-pagamentos-${suffix}@teste-pagamentos.com`,
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

async function criarOperadorLogado(adminAccessToken: string): Promise<string> {
  const email = `operador-pagamentos-${randomUUID().slice(0, 8)}@teste-pagamentos.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });

  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: 'Operador Pagamentos', email, papel: 'operador' });
  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  return loginRes.body.accessToken;
}

async function criarViagem(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const res = await request(app)
    .post('/viagens')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nome: 'Bariloche de Moto',
      destinoCidade: 'Bariloche',
      destinoUf: 'RS',
      dataInicio: '2027-03-01',
      dataFim: '2027-03-10',
      capacidade: 10,
      precoTitular: 1000,
      precoAcompanhante: 800,
      ...overrides,
    });
  return res.body.viagem as { id: string; status: string };
}

async function abrirInscricoes(token: string, viagemId: string) {
  await request(app)
    .patch(`/viagens/${viagemId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'inscricoes' });
}

async function criarCliente(token: string, nome = `Cliente ${randomUUID().slice(0, 6)}`) {
  const res = await request(app)
    .post('/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome, telefone: '11900000000' });
  return res.body.cliente as { id: string };
}

/** Cria viagem + abre inscrições + cria cliente + inscreve, retorna a inscrição criada. */
async function criarInscricaoFixture(token: string, valorTotal = 1000) {
  const viagem = await criarViagem(token);
  await abrirInscricoes(token, viagem.id);
  const cliente = await criarCliente(token);
  const res = await request(app)
    .post(`/viagens/${viagem.id}/inscricoes`)
    .set('Authorization', `Bearer ${token}`)
    .send({ clienteId: cliente.id, valorTotal });
  return { ...res.body.inscricao, viagemId: viagem.id } as { id: string; valorTotal: string; viagemId: string };
}

afterAll(async () => {
  const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
  for (const tenantId of createdTenantIds) {
    await adminClient.pagamento.deleteMany({ where: { tenantId } });
    await adminClient.inscricao.deleteMany({ where: { tenantId } });
    await adminClient.despesa.deleteMany({ where: { tenantId } });
    await adminClient.viagemHotel.deleteMany({ where: { tenantId } });
    await adminClient.viagemAtracao.deleteMany({ where: { tenantId } });
    await adminClient.viagemIncluso.deleteMany({ where: { tenantId } });
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

describe('Regra: status derivado muda de pendente → parcial → pago', () => {
  it('reflete o status conforme os pagamentos entram, refletido na listagem de inscrições', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const inscricao = await criarInscricaoFixture(adminAccessToken, 1000);

    const statusInicial = await request(app)
      .get(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(statusInicial.body.pagamentos).toHaveLength(0);

    const primeiro = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 300, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(primeiro.status).toBe(201);

    // Status parcial já deve refletir na listagem de inscrições da viagem.
    const listaParcial = await buscarInscricaoNaListagem(adminAccessToken, inscricao.viagemId, inscricao.id);
    expect(listaParcial.statusPagamento).toBe('parcial');
    expect(listaParcial.valorPago).toBe('300');

    const segundo = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 700, forma: 'Cartão', parcelas: 3, dataPagamento: '2027-01-15' });
    expect(segundo.status).toBe(201);

    const listaPago = await buscarInscricaoNaListagem(adminAccessToken, inscricao.viagemId, inscricao.id);
    expect(listaPago.statusPagamento).toBe('pago');
    expect(listaPago.valorPago).toBe('1000');
  });
});

async function buscarInscricaoNaListagem(token: string, viagemId: string, inscricaoId: string) {
  const res = await request(app).get(`/viagens/${viagemId}/inscricoes`).set('Authorization', `Bearer ${token}`);
  const encontrada = res.body.inscricoes.find((i: { id: string }) => i.id === inscricaoId);
  if (!encontrada) throw new Error('Inscrição não encontrada na listagem da viagem');
  return encontrada;
}

describe('Regra: excesso sem flag é rejeitado', () => {
  it('rejeita pagamento que estoura valor_total sem ajusteFinanceiro, aceita com a flag + observações', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const inscricao = await criarInscricaoFixture(adminAccessToken, 500);

    const excesso = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 600, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(excesso.status).toBe(400);
    expect(excesso.body.error.code).toBe('EXCEDE_VALOR_TOTAL');

    const semObservacao = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 600, forma: 'Pix', dataPagamento: '2027-01-01', ajusteFinanceiro: true });
    expect(semObservacao.status).toBe(400); // schema exige observações quando ajusteFinanceiro=true

    const comAjuste = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        valor: 600,
        forma: 'Pix',
        dataPagamento: '2027-01-01',
        ajusteFinanceiro: true,
        observacoes: 'Cliente pagou a mais por engano, será usado como crédito futuro',
      });
    expect(comAjuste.status).toBe(201);
  });

  it('valores não positivos são rejeitados', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const inscricao = await criarInscricaoFixture(adminAccessToken, 500);

    const zero = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 0, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(zero.status).toBe(400);

    const negativo = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: -100, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(negativo.status).toBe(400);
  });
});

describe('Regra: forma fora da lista do tenant é rejeitada', () => {
  it('rejeita forma que não está em tenant_settings.formasPagamento', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const inscricao = await criarInscricaoFixture(adminAccessToken, 500);

    const invalida = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 100, forma: 'Criptomoeda', dataPagamento: '2027-01-01' });
    expect(invalida.status).toBe(400);
    expect(invalida.body.error.code).toBe('FORMA_PAGAMENTO_INVALIDA');

    // Removendo "Pix" das formas do tenant, uma forma antes válida passa a ser rejeitada.
    await request(app)
      .patch('/configuracoes/preferencias')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ formasPagamento: ['Cartão', 'Dinheiro'] });

    const pixAgoraInvalido = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 100, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(pixAgoraInvalido.status).toBe(400);
    expect(pixAgoraInvalido.body.error.code).toBe('FORMA_PAGAMENTO_INVALIDA');

    const cartaoValido = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 100, forma: 'Cartão', dataPagamento: '2027-01-01' });
    expect(cartaoValido.status).toBe(201);
  });
});

describe('Regra: DELETE de pagamento — apenas admin, motivo obrigatório, audit_log', () => {
  it('operador recebe 403 ao tentar deletar', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);
    const inscricao = await criarInscricaoFixture(adminAccessToken, 500);

    const pagamentoRes = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 100, forma: 'Pix', dataPagamento: '2027-01-01' });
    const pagamentoId = pagamentoRes.body.pagamento.id;

    const res = await request(app)
      .delete(`/pagamentos/${pagamentoId}`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ motivo: 'Tentativa de operador' });
    expect(res.status).toBe(403);
  });

  it('admin sem motivo é rejeitado; com motivo apaga e gera audit_log', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const inscricao = await criarInscricaoFixture(adminAccessToken, 500);

    const pagamentoRes = await request(app)
      .post(`/inscricoes/${inscricao.id}/pagamentos`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ valor: 100, forma: 'Pix', dataPagamento: '2027-01-01' });
    const pagamentoId = pagamentoRes.body.pagamento.id;

    const semMotivo = await request(app)
      .delete(`/pagamentos/${pagamentoId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({});
    expect(semMotivo.status).toBe(400);

    const comMotivo = await request(app)
      .delete(`/pagamentos/${pagamentoId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ motivo: 'Pagamento duplicado por engano' });
    expect(comMotivo.status).toBe(204);

    const pagamentoAinda = await runWithTenant(tenantId, () =>
      prisma.pagamento.findUnique({ where: { id: pagamentoId } }),
    );
    expect(pagamentoAinda).toBeNull();

    const auditLogs = await runWithTenant(tenantId, () =>
      prisma.auditLog.findMany({ where: { entidade: 'pagamento', acao: 'delete', entidadeId: pagamentoId } }),
    );
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0].dadosDepois as { motivo: string }).motivo).toBe('Pagamento duplicado por engano');
  });
});

describe('Isolamento entre tenants (404)', () => {
  it('não permite criar/listar/deletar pagamento de inscrição de outro tenant', async () => {
    const { adminAccessToken: tokenA } = await criarTenantComAdmin();
    const { adminAccessToken: tokenB } = await criarTenantComAdmin();

    const inscricaoA = await criarInscricaoFixture(tokenA, 500);

    const listarComB = await request(app)
      .get(`/inscricoes/${inscricaoA.id}/pagamentos`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listarComB.status).toBe(404);

    const criarComB = await request(app)
      .post(`/inscricoes/${inscricaoA.id}/pagamentos`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ valor: 100, forma: 'Pix', dataPagamento: '2027-01-01' });
    expect(criarComB.status).toBe(404);

    const pagamentoA = await request(app)
      .post(`/inscricoes/${inscricaoA.id}/pagamentos`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ valor: 100, forma: 'Pix', dataPagamento: '2027-01-01' });

    const deletarComB = await request(app)
      .delete(`/pagamentos/${pagamentoA.body.pagamento.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ motivo: 'Tentando de outro tenant' });
    expect(deletarComB.status).toBe(404);
  });
});
