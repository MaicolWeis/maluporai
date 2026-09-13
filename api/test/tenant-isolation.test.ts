import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenant-context.js';

describe('Isolamento multi-tenant (P1 — RLS + Prisma extension)', () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let clienteA: { id: string; tenantId: string };
  let clienteB: { id: string; tenantId: string };

  beforeAll(async () => {
    tenantA = await prisma.tenant.create({
      data: {
        nomeFantasia: 'Teste Tenant A',
        documento: '00000000000191',
        emailContato: 'a@teste-isolamento.com',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        nomeFantasia: 'Teste Tenant B',
        documento: '11444777000161',
        emailContato: 'b@teste-isolamento.com',
      },
    });

    clienteA = await runWithTenant(tenantA.id, () =>
      prisma.cliente.create({ data: { nome: 'Cliente A', telefone: '11900000001' } }),
    );
    clienteB = await runWithTenant(tenantB.id, () =>
      prisma.cliente.create({ data: { nome: 'Cliente B', telefone: '11900000002' } }),
    );
  });

  afterAll(async () => {
    await runWithTenant(tenantA.id, () => prisma.cliente.deleteMany({ where: { tenantId: tenantA.id } }));
    await runWithTenant(tenantB.id, () => prisma.cliente.deleteMany({ where: { tenantId: tenantB.id } }));

    // app_user (role da aplicação) não tem DELETE em tenants por design —
    // nenhuma feature do produto apaga tenant. A limpeza deste teste usa a
    // role de admin só para não deixar lixo entre execuções.
    const adminClient = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
    await adminClient.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    await adminClient.$disconnect();

    await prisma.$disconnect();
  });

  it('query com tenant A não retorna registros do tenant B', async () => {
    const clientes = await runWithTenant(tenantA.id, () => prisma.cliente.findMany());

    expect(clientes.some((c) => c.id === clienteA.id)).toBe(true);
    expect(clientes.some((c) => c.id === clienteB.id)).toBe(false);
    expect(clientes.every((c) => c.tenantId === tenantA.id)).toBe(true);
  });

  it('insert herda tenant_id do contexto mesmo se o payload tentar sobrescrever', async () => {
    const created = await runWithTenant(tenantA.id, () =>
      prisma.cliente.create({
        data: { nome: 'Tentando forjar tenant', telefone: '11900000003', tenantId: tenantB.id },
      }),
    );

    expect(created.tenantId).toBe(tenantA.id);
    expect(created.tenantId).not.toBe(tenantB.id);

    await runWithTenant(tenantA.id, () => prisma.cliente.delete({ where: { id: created.id } }));
  });

  it('lança erro explícito se uma query de negócio rodar sem tenant no contexto', async () => {
    await expect(prisma.cliente.findMany()).rejects.toThrow(/tenant/i);
  });

  it('conexão app_user com app.tenant_id ausente não lê nenhuma linha (RLS no banco)', async () => {
    // PrismaClient "cru": sem a extensão de tenant, sem nenhum SET LOCAL.
    // Simula um bug de aplicação que esqueceu de propagar o contexto —
    // a segunda camada de defesa (RLS no Postgres) precisa segurar sozinha.
    const rawAppUserClient = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
    try {
      const rows = await rawAppUserClient.$queryRawUnsafe('SELECT * FROM clientes');
      expect(Array.isArray(rows)).toBe(true);
      expect((rows as unknown[]).length).toBe(0);
    } finally {
      await rawAppUserClient.$disconnect();
    }
  });
});
