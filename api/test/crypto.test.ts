import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, hashForLookup } from '../src/lib/crypto.js';

describe('crypto (AES-256-GCM + hash determinístico)', () => {
  it('faz o round-trip de encrypt/decrypt corretamente', () => {
    const cpf = '12345678900';
    const ciphertext = encryptField(cpf);

    expect(ciphertext).not.toBe(cpf);
    expect(decryptField(ciphertext)).toBe(cpf);
  });

  it('gera ciphertexts diferentes para o mesmo valor (IV aleatório)', () => {
    const cpf = '12345678900';
    expect(encryptField(cpf)).not.toBe(encryptField(cpf));
  });

  it('recusa decriptar um ciphertext adulterado (auth tag do GCM)', () => {
    const ciphertext = encryptField('12345678900');
    const raw = Buffer.from(ciphertext, 'base64');
    raw[raw.length - 1] ^= 0xff; // corrompe o último byte do ciphertext
    const tampered = raw.toString('base64');

    expect(() => decryptField(tampered)).toThrow();
  });

  it('hashForLookup é determinístico para o mesmo valor', () => {
    expect(hashForLookup('12345678900')).toBe(hashForLookup('12345678900'));
  });

  it('hashForLookup produz hashes diferentes para valores diferentes', () => {
    expect(hashForLookup('12345678900')).not.toBe(hashForLookup('00987654321'));
  });
});
