import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Tokens opacos (refresh e reset de senha): alta entropia, nunca guardados
 * em texto puro no banco — só o hash. Usa JWT_REFRESH_SECRET como chave do
 * HMAC (pepper): mesmo com o banco vazado, o hash não é recalculável sem o
 * segredo do servidor.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(rawToken: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}
