import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from './errors.js';

interface TenantStore {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Roda `fn` com tenantId no AsyncLocalStorage. O wrapper `async () => fn()`
 * é necessário mesmo parecendo redundante: o PrismaClient devolve um
 * "PrismaPromise" preguiçoso (thenable customizado) cuja query só executa
 * quando algo chama `.then()`. Se `fn()` fosse devolvido cru, esse `.then()`
 * só aconteceria no `await` do chamador — já fora da janela síncrona do
 * `storage.run`, perdendo o contexto do tenant. Envolver em uma função
 * async força a Promise nativa (e o `.then()` da thenable) a serem criados
 * ainda dentro do `run()`, preservando o contexto até a query terminar.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
  return storage.run({ tenantId }, async () => fn());
}

export function getCurrentTenantId(): string {
  const store = storage.getStore();
  if (!store) {
    throw new AppError(500, 'TENANT_CONTEXT_MISSING', 'Query de negócio executada sem tenant no contexto');
  }
  return store.tenantId;
}

export function getCurrentTenantIdOrNull(): string | null {
  return storage.getStore()?.tenantId ?? null;
}
