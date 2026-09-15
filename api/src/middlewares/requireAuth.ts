import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';

/**
 * Valida o access token (Bearer). Só popula req.auth — quem propaga para o
 * AsyncLocalStorage é o middleware tenantContext (P1), que deve ser
 * encadeado logo depois: router.use(requireAuth, tenantContext).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Autenticação necessária'));
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.auth = { tenantId: payload.tenantId, userId: payload.sub, papel: payload.papel };
    next();
  } catch {
    next(unauthorized('Sessão expirada ou inválida'));
  }
}
