import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Uma linha de log por chamada à API, com quem chamou (usuário e empresa),
 * a rota em forma de modelo (ex.: GET /clientes/:id — sem IDs nem query
 * string, que podem carregar dados), status, duração e IP real.
 * Nunca registra corpo, cabeçalhos, tokens ou o conteúdo da resposta.
 * Fica nos logs do Railway: filtre por `usuario=<id>` ou `acesso`.
 */
export function logAcesso(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const bruta = req.route?.path
      ? `${req.baseUrl}${req.route.path === '/' ? '' : req.route.path}`
      : `${req.baseUrl}${req.path}`;
    const rota = (bruta.replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:id') || '/').slice(0, 120);
    logger.info(
      {
        tipo: 'acesso',
        usuario: req.auth?.userId ?? null,
        empresa: req.auth?.tenantId ?? null,
        metodo: req.method,
        rota,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
        ip: req.ip,
        requestId: req.id,
      },
      `acesso ${req.method} ${rota} ${res.statusCode}`,
    );
  });
  next();
}
