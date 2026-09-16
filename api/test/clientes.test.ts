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
    nomeFantasia: `Empresa Clientes ${suffix}`,
    documento: '12345678000190',
    nome: `Admin ${suffix}`,
    email: `admin-clientes-${suffix}@teste-clientes.com`,
    senha: `SenhaForte-${suffix}-9x`,
  };
}

async function criarTenantComAdmin() {
  const suffix = randomUUID().slice(0, 8);
  const payload = signupPayload(suffix);
  const res = await request(app).post('/auth/signup').send(payload);
  createdTenantIds.push(res.body.user.tenant.id);
  return {
    tenantId: res.body.user.tenant.id as string,
    adminAccessToken: res.body.accessToken as string,
    adminSenha: payload.senha,
  };
}

function extractActivationToken(html: string): string {
  const match = html.match(/\/ativar-conta\/([^"<\s]+)/);
  if (!match) throw new Error('Token de ativação não encontrado no e-mail simulado');
  return match[1];
}

async function criarOperadorLogado(adminAccessToken: string): Promise<string> {
  const email = `operador-clientes-${randomUUID().slice(0, 8)}@teste-clientes.com`;
  let capturedHtml = '';
  const spy = vi.spyOn(emailService, 'send').mockImplementation(async (msg) => {
    capturedHtml = msg.html;
  });
  await request(app)
    .post('/usuarios/convites')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ nome: 'Operador Clientes', email, papel: 'operador' });
  const token = extractActivationToken(capturedHtml);
  spy.mockRestore();

  const senha = `SenhaOperador-${randomUUID().slice(0, 6)}-9x`;
  await request(app).post('/auth/ativar-conta').send({ token, senha });
  const loginRes = await request(app).post('/auth/login').send({ email, senha });
  return loginRes.body.accessToken;
}

/** Fixture direta via Prisma: Viagem + Inscrição (a API de Viagens é do P6, ainda não existe). */
async function criarInscricaoFixture(tenantId: string, clienteId: string, valorTotal: number) {
  return runWithTenant(tenantId, async () => {
    const viagem = await prisma.viagem.create({
      data: {
        nome: `Viagem Fixture ${randomUUID().slice(0, 6)}`,
        destinoCidade: 'Foz do Iguaçu',
        destinoUf: 'PR',
        dataInicio: new Date('2027-03-01'),
        dataFim: new Date('2027-03-05'),
        capacidade: 30,
        precoTitular: 1500,
      },
    });
    const inscricao = await prisma.inscricao.create({
      data: { viagemId: viagem.id, clienteId, valorTotal },
    });
    return { viagemId: viagem.id, inscricaoId: inscricao.id };
  });
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

describe('Regra: listagem nunca expõe CPF', () => {
  it('GET /clientes não inclui cpf em nenhum item, mesmo tendo cadastrado um', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();

    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Cliente Com CPF', telefone: '11900000001', cpf: '123.456.789-09' });
    expect(criarRes.status).toBe(201);

    const listaRes = await request(app)
      .get('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(listaRes.status).toBe(200);

    const item = listaRes.body.clientes.find((c: { id: string }) => c.id === criarRes.body.cliente.id);
    expect(item).toBeDefined();
    expect(item.cpf).toBeUndefined();
    expect(item.cpfHash).toBeUndefined();
    expect(JSON.stringify(listaRes.body)).not.toContain('12345678909');
  });
});

describe('Regra: revelar CPF gera audit_log', () => {
  it('GET /clientes/:id/cpf devolve o CPF em texto pleno e grava um audit_log de export', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();

    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Cliente Revelar', telefone: '11900000002', cpf: '987.654.321-00' });
    const clienteId = criarRes.body.cliente.id;
    expect(criarRes.body.cliente.cpfMascarado).toBe('***.***.***-00');

    const revelarRes = await request(app)
      .get(`/clientes/${clienteId}/cpf`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(revelarRes.status).toBe(200);
    expect(revelarRes.body.cpf).toBe('98765432100');

    const logs = await runWithTenant(tenantId, () =>
      prisma.auditLog.findMany({ where: { entidade: 'cliente_cpf', entidadeId: clienteId } }),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].acao).toBe('export');
    expect(logs[0].userId).toBeTruthy();
  });
});

describe('Regra: anonimização é irreversível e preserva valores financeiros', () => {
  it('substitui os dados de identificação, marca anonimizado_em e não afeta a inscrição/valor', async () => {
    const { adminAccessToken, adminSenha, tenantId } = await criarTenantComAdmin();

    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        nome: 'Fulano Da Silva',
        telefone: '11900000003',
        cpf: '111.222.333-44',
        email: 'fulano@teste-clientes.com',
      });
    const clienteId = criarRes.body.cliente.id;

    const { inscricaoId } = await criarInscricaoFixture(tenantId, clienteId, 1500);

    const anonRes = await request(app)
      .post(`/clientes/${clienteId}/anonimizar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ senhaConfirmacao: adminSenha, confirmacaoNome: 'Fulano Da Silva' });

    expect(anonRes.status).toBe(200);
    expect(anonRes.body.cliente.nome).not.toBe('Fulano Da Silva');
    expect(anonRes.body.cliente.email).toBeNull();
    expect(anonRes.body.cliente.telefone).toBe('ANONIMIZADO');
    expect(anonRes.body.cliente.cpfMascarado).toBeNull();
    expect(anonRes.body.cliente.anonimizadoEm).toBeTruthy();

    // Irreversível: não existe endpoint de "desfazer" e uma segunda
    // tentativa é recusada — não há como voltar ao estado anterior.
    const segundaTentativa = await request(app)
      .post(`/clientes/${clienteId}/anonimizar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ senhaConfirmacao: adminSenha, confirmacaoNome: anonRes.body.cliente.nome });
    expect(segundaTentativa.status).toBe(400);

    const cpfRes = await request(app)
      .get(`/clientes/${clienteId}/cpf`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(cpfRes.status).toBe(404);

    // Valor financeiro da inscrição continua intacto.
    const inscricao = await runWithTenant(tenantId, () =>
      prisma.inscricao.findUniqueOrThrow({ where: { id: inscricaoId } }),
    );
    expect(Number(inscricao.valorTotal)).toBe(1500);
    expect(inscricao.clienteId).toBe(clienteId);
  });

  it('exige a senha correta do admin e recusa se o nome de confirmação não confere', async () => {
    const { adminAccessToken, adminSenha } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Precisa Confirmar', telefone: '11900000004' });
    const clienteId = criarRes.body.cliente.id;

    const senhaErrada = await request(app)
      .post(`/clientes/${clienteId}/anonimizar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ senhaConfirmacao: 'senha-errada-123', confirmacaoNome: 'Precisa Confirmar' });
    expect(senhaErrada.status).toBe(401);

    const nomeErrado = await request(app)
      .post(`/clientes/${clienteId}/anonimizar`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ senhaConfirmacao: adminSenha, confirmacaoNome: 'Nome Errado' });
    expect(nomeErrado.status).toBe(400);
  });

  it('operador recebe 403 ao tentar anonimizar (só lgpd_anonimizacao)', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Alvo Operador', telefone: '11900000005' });

    const res = await request(app)
      .post(`/clientes/${criarRes.body.cliente.id}/anonimizar`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ senhaConfirmacao: 'qualquer', confirmacaoNome: 'Alvo Operador' });
    expect(res.status).toBe(403);
  });
});

describe('Regra: DELETE bloqueado com inscrição existente', () => {
  it('recusa excluir cliente com inscrição e orienta anonimizar', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Tem Inscrição', telefone: '11900000006' });
    const clienteId = criarRes.body.cliente.id;

    await criarInscricaoFixture(tenantId, clienteId, 800);

    const delRes = await request(app)
      .delete(`/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(delRes.status).toBe(409);
    expect(delRes.body.error.message.toLowerCase()).toContain('anonimiz');
  });

  it('permite excluir cliente sem nenhuma inscrição', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Sem Inscrição', telefone: '11900000007' });

    const delRes = await request(app)
      .delete(`/clientes/${criarRes.body.cliente.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(delRes.status).toBe(204);
  });
});

describe('Regra: exportação retorna todos os dados do titular', () => {
  it('GET /clientes/:id/exportar traz cadastro (com CPF em texto pleno), inscrições e pagamentos', async () => {
    const { adminAccessToken, tenantId } = await criarTenantComAdmin();
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Exportável', telefone: '11900000008', cpf: '555.666.777-88' });
    const clienteId = criarRes.body.cliente.id;

    const { inscricaoId } = await criarInscricaoFixture(tenantId, clienteId, 900);
    await runWithTenant(tenantId, () =>
      prisma.pagamento.create({
        data: { inscricaoId, valor: 300, forma: 'pix', dataPagamento: new Date('2027-01-15') },
      }),
    );

    const exportRes = await request(app)
      .get(`/clientes/${clienteId}/exportar`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.cadastro.nome).toBe('Exportável');
    expect(exportRes.body.cadastro.cpf).toBe('55566677788');
    expect(exportRes.body.inscricoes).toHaveLength(1);
    expect(exportRes.body.inscricoes[0].id).toBe(inscricaoId);
    expect(Number(exportRes.body.inscricoes[0].valorTotal)).toBe(900);
    expect(exportRes.body.inscricoes[0].pagamentos).toHaveLength(1);
    expect(Number(exportRes.body.inscricoes[0].pagamentos[0].valor)).toBe(300);

    const logs = await runWithTenant(tenantId, () =>
      prisma.auditLog.findMany({ where: { entidade: 'cliente', acao: 'export', entidadeId: clienteId } }),
    );
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('operador recebe 403 ao tentar exportar (só lgpd_anonimizacao)', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);
    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ nome: 'Alvo Export', telefone: '11900000009' });

    const res = await request(app)
      .get(`/clientes/${criarRes.body.cliente.id}/exportar`)
      .set('Authorization', `Bearer ${operadorToken}`);
    expect(res.status).toBe(403);
  });
});

describe('CRUD básico e isolamento', () => {
  it('operador consegue listar/criar/editar clientes (módulo "clientes")', async () => {
    const { adminAccessToken } = await criarTenantComAdmin();
    const operadorToken = await criarOperadorLogado(adminAccessToken);

    const criarRes = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ nome: 'Criado Por Operador', telefone: '11900000010' });
    expect(criarRes.status).toBe(201);

    const patchRes = await request(app)
      .patch(`/clientes/${criarRes.body.cliente.id}`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ cidade: 'Curitiba' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.cliente.cidade).toBe('Curitiba');
    expect(patchRes.body.cliente.nome).toBe('Criado Por Operador');
  });

  it('cliente criado em um tenant não aparece na listagem de outro (RLS)', async () => {
    const tenantA = await criarTenantComAdmin();
    const tenantB = await criarTenantComAdmin();

    await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${tenantA.adminAccessToken}`)
      .send({ nome: 'Só do Tenant A', telefone: '11900000011' });

    const listaB = await request(app)
      .get('/clientes')
      .set('Authorization', `Bearer ${tenantB.adminAccessToken}`);
    expect(listaB.body.clientes.some((c: { nome: string }) => c.nome === 'Só do Tenant A')).toBe(false);
  });
});
