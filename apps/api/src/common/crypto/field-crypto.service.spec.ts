import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../../config/app-config.js';
import { FieldCryptoService, maskIdentifier, normaliseIdentifier } from './field-crypto.service.js';

const config = {
  encryption: { fieldKey: randomBytes(32), hashKey: randomBytes(32), documentKey: randomBytes(32) },
} as AppConfig;
const crypto = new FieldCryptoService(config);

describe('FieldCryptoService', () => {
  it('round-trips a value and never produces the same ciphertext twice', () => {
    const first = crypto.encrypt('01-234567');
    const second = crypto.encrypt('01-234567');
    expect(first).not.toBe(second);
    expect(first.startsWith('v1:')).toBe(true);
    expect(crypto.decrypt(first)).toBe('01-234567');
  });

  it('detects tampering through the authentication tag', () => {
    const encrypted = crypto.encrypt('01-234567');
    const bytes = Buffer.from(encrypted.slice(3), 'base64');
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => crypto.decrypt(`v1:${bytes.toString('base64')}`)).toThrow();
  });

  it('produces the same blind index for differently formatted identifiers', () => {
    expect(crypto.blindIndex('01-234567')).toBe(crypto.blindIndex(' 01 234567 '));
    expect(crypto.blindIndex('01-234567')).not.toBe(crypto.blindIndex('01-234568'));
  });

  it('normalises and masks identifiers', () => {
    expect(normaliseIdentifier('ab-12/34')).toBe('AB1234');
    expect(maskIdentifier('01-234567')).toBe('*****4567');
  });
});
