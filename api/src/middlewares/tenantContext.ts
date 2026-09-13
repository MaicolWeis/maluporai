import type { NextFunction, Request, Response } from 'express';
import { runWithTenant } from '../lib/tenant-context.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populado pelo middleware requireAuth (P2) a partir do JWT validado. */
    auth?: {
      tenantId: string;
      userId: string;
      papel: string;
    };
  }
}

/**
 * Propaga o tenant_id do JWT já validado (req.auth) para o
 * AsyncLocalStorage, para todo o restante da cadeia de handlers desta
 * requisição. tenant_id nunca é lido do body/query — apenas do token.
 *
 * Rotas públicas (sem req.auth, ex.: /health, /auth/login) seguem sem
 * contexto: qualquer tentativa de rodar uma query de negócio nelas vai
 * falhar explicitamente em getCurrentTenantId().
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) {
    return next();
  }
  runWithTenant(req.auth.tenantId, next).catch(next);
}
