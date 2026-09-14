import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt.js';

describe('jwt (access token)', () => {
  it('assina e verifica o payload corretamente', () => {
    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-1', papel: 'admin' });
    const payload = verifyAccessToken(token);
    expect(payload).toEqual({ sub: 'user-1', tenantId: 'tenant-1', papel: 'admin' });
  });

  it('lança para token adulterado', () => {
    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-1', papel: 'admin' });
    const adulterado = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(adulterado)).toThrow();
  });

  it('lança para token expirado', () => {
    const expiredToken = jwt.sign({ sub: 'u', tenantId: 't', papel: 'admin' }, env.JWT_SECRET, {
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(expiredToken)).toThrow();
  });
});
