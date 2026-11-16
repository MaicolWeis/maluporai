import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Limites por tipo de rota (P11). Desligados em NODE_ENV=test: a suíte faz
 * centenas de chamadas do mesmo IP e não testa estes limites (o de login
 * tem teste próprio e continua ativo).
 */
const emTeste = () => env.NODE_ENV === 'test';

function responder(_req: Request, res: Response) {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em alguns minutos.' },
  });
}

/** Rotas públicas sensíveis (signup, reset, ativação): 20 / 15 min por IP. */
export const authSensivelRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: emTeste,
  handler: responder,
});

/** Escrita (POST/PUT/PATCH/DELETE) autenticada: 120 / min por usuário (ou IP). */
export const escritaRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => emTeste() || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'anon',
  handler: responder,
});

/** Teto geral por IP: 1000 / 15 min (o app faz várias leituras por tela). */
export const geralRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: emTeste,
  handler: responder,
});
