import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

function segredoConfere(recebido: string | undefined, esperado: string) {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function primeiroIp(valor: string | string[] | undefined) {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v?.split(',')[0]?.trim() || undefined;
}

/**
 * Origem atrás do proxy da Vercel (P11).
 *
 * Com ORIGIN_SECRET configurado, a Vercel anexa `x-origin-secret` a toda
 * requisição que repassa para a API (transform em web/vercel.json). Aqui:
 * - requisição sem o segredo correto é recusada (403) — ninguém fala com o
 *   Railway direto contornando rate limit/CORS. /health fica liberado para o
 *   healthcheck do Railway;
 * - com o segredo válido, o IP do visitante informado pela Vercel passa a
 *   ser o req.ip (rate limit e auditoria). Sem o segredo, nenhum cabeçalho
 *   de IP do cliente é confiado.
 *
 * Sem ORIGIN_SECRET (dev/test), o middleware não faz nada.
 */
export function origemVercel(req: Request, res: Response, next: NextFunction) {
  const segredo = env.ORIGIN_SECRET;
  if (!segredo) return next();

  if (!segredoConfere(req.header('x-origin-secret') ?? undefined, segredo)) {
    if (req.path === '/health') return next();
    return res.status(403).json({ error: { code: 'ORIGEM_NAO_AUTORIZADA', message: 'Acesso direto não permitido' } });
  }

  const ipVisitante =
    primeiroIp(req.headers['x-vercel-forwarded-for']) ??
    primeiroIp(req.headers['x-real-ip']) ??
    primeiroIp(req.headers['x-forwarded-for']);
  if (ipVisitante) {
    Object.defineProperty(req, 'ip', { value: ipVisitante, configurable: true });
  }
  next();
}
