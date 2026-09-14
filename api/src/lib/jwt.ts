import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  papel: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

/** Lança se o token for inválido, expirado ou malformado. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.tenantId || !decoded.papel) {
    throw new Error('Payload de access token inválido');
  }
  return { sub: decoded.sub, tenantId: decoded.tenantId, papel: decoded.papel };
}
