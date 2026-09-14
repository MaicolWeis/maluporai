import { describe, expect, it } from 'vitest';
import { hashPassword, isCommonPassword, verifyPassword } from '../src/lib/password.js';

describe('password (argon2id + lista de senhas comuns)', () => {
  it('faz o round-trip de hash/verify corretamente', async () => {
    const hash = await hashPassword('UmaSenhaBemForte123');
    expect(hash).not.toBe('UmaSenhaBemForte123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'UmaSenhaBemForte123')).toBe(true);
    expect(await verifyPassword(hash, 'senha-errada')).toBe(false);
  });

  it('verifyPassword nunca lança para hash malformado', async () => {
    await expect(verifyPassword('não-é-um-hash-argon2', 'qualquer')).resolves.toBe(false);
  });

  it('detecta senhas comuns (case-insensitive)', () => {
    expect(isCommonPassword('123456')).toBe(true);
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('Qwerty123')).toBe(true);
  });

  it('não recusa uma senha forte e incomum', () => {
    expect(isCommonPassword('Xk9$mQ2vLp7#nR4z')).toBe(false);
  });
});
