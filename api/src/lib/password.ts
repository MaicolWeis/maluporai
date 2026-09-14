import argon2 from 'argon2';
import { COMMON_PASSWORDS } from './common-passwords.js';

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // hash malformado/algoritmo incompatível — trata como senha incorreta,
    // nunca deixa vazar detalhe de erro para quem está fazendo login.
    return false;
  }
}

export function isCommonPassword(plain: string): boolean {
  return COMMON_PASSWORDS.has(plain.toLowerCase());
}
