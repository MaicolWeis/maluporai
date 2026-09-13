import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  logger.error({ err, requestId: req.id }, 'Erro não tratado');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } });
}
