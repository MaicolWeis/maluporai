import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** Rotas inexistentes: JSON (sem a página padrão do Express, que revela a tecnologia). */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  // Corpo JSON malformado (body-parser): erro do cliente, não do servidor.
  const tipo = (err as Error & { type?: string }).type;
  if (tipo === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'Corpo da requisição inválido' } });
  }
  if (tipo === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'CORPO_GRANDE_DEMAIS', message: 'Corpo da requisição grande demais' } });
  }
  // ID que não é UUID chegando ao banco (Prisma P2023 / Postgres 22P02): trata como inexistente.
  const codigo = (err as Error & { code?: string }).code;
  if (codigo === 'P2023' || codigo === '22P02' || /invalid input syntax for type uuid|Error creating UUID/i.test(err.message)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } });
  }
  logger.error({ err, requestId: req.id }, 'Erro não tratado');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } });
}
