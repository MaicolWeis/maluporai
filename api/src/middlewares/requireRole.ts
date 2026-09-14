import type { NextFunction, Request, Response } from 'express';
import { forbidden } from '../lib/errors.js';

export function requireRole(...papeis: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !papeis.includes(req.auth.papel)) {
      return next(forbidden());
    }
    next();
  };
}
