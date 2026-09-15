import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { forbidden } from '../lib/errors.js';
import { can, type Modulo } from '../policies/index.js';

/** Checa via policies/can() em vez de comparar papel diretamente na rota. */
export function requirePermission(modulo: Modulo) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !can(req.auth.papel as UserRole, modulo)) {
      return next(forbidden());
    }
    next();
  };
}
