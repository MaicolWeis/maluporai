import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { getCurrentTenantId } from './tenant-context.js';

/**
 * Modelos que não carregam tenant_id (a raiz do isolamento) e por isso não
 * passam pelo SET LOCAL app.tenant_id nem pela injeção automática.
 */
const TENANT_EXEMPT_MODELS = new Set<string>(['Tenant']);

const OPERATIONS_WITH_DATA = new Set(['create', 'createManyAndReturn']);

function injectTenantIdIntoRecord<T>(data: T, tenantId: string): T {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, tenantId };
  }
  return data;
}

/**
 * Garante que tenant_id sempre vem do contexto (JWT), nunca do payload do
 * client — sobrescreve qualquer tenantId que a chamada tente enviar.
 */
function withTenantId(operation: string, args: unknown, tenantId: string): unknown {
  if (!args || typeof args !== 'object') return args;
  const typedArgs = args as Record<string, unknown>;

  if (OPERATIONS_WITH_DATA.has(operation)) {
    return { ...typedArgs, data: injectTenantIdIntoRecord(typedArgs.data, tenantId) };
  }

  if (operation === 'createMany') {
    const data = typedArgs.data;
    const nextData = Array.isArray(data)
      ? data.map((item) => injectTenantIdIntoRecord(item, tenantId))
      : injectTenantIdIntoRecord(data, tenantId);
    return { ...typedArgs, data: nextData };
  }

  if (operation === 'upsert') {
    return { ...typedArgs, create: injectTenantIdIntoRecord(typedArgs.create, tenantId) };
  }

  return args;
}

const tenantIsolationExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || TENANT_EXEMPT_MODELS.has(model)) {
            return query(args);
          }

          // Lança AppError(TENANT_CONTEXT_MISSING) se não houver tenant no
          // AsyncLocalStorage — nenhuma query de negócio roda sem contexto.
          const tenantId = getCurrentTenantId();
          const nextArgs = withTenantId(operation, args, tenantId);

          const [, result] = await client.$transaction([
            client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
            query(nextArgs as typeof args),
          ]);
          return result;
        },
      },
    },
  }),
);

const basePrisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
});

export const prisma = basePrisma.$extends(tenantIsolationExtension);

export type PrismaTenantClient = typeof prisma;
