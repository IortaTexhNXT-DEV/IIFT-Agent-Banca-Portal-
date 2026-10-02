import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_VERSION = 'v1';

/**
 * Field-level protection for personal identifiers (IC / passport numbers).
 *
 * - `encrypt`/`decrypt`: AES-256-GCM with a random IV per value. Output is
 *   "<keyVersion>:<base64(iv | tag | ciphertext)>" so keys can be rotated later.
 * - `blindIndex`: keyed HMAC-SHA256 of the normalised value. Stored next to the
 *   ciphertext so records can be found by exact identifier without decrypting.
 */
@Injectable()
export class FieldCryptoService {
  private readonly fieldKey: Buffer;
  private readonly hashKey: Buffer;

  constructor(config: AppConfig) {
    this.fieldKey = config.encryption.fieldKey;
    this.hashKey = config.encryption.hashKey;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.fieldKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    return `${KEY_VERSION}:${payload}`;
  }

  decrypt(stored: string): string {
    const [version, payload] = stored.split(':', 2);
    if (version !== KEY_VERSION || !payload) {
      throw new Error('Unsupported encrypted value format');
    }
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.fieldKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  blindIndex(value: string): string {
    return createHmac('sha256', this.hashKey).update(normaliseIdentifier(value)).digest('hex');
  }
}

/** Identifiers are compared case-insensitively and without separators. */
export function normaliseIdentifier(value: string): string {
  return value.replace(/[\s\-/]/g, '').toUpperCase();
}

/** Shows only the last four characters, e.g. "******1234". */
export function maskIdentifier(value: string): string {
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(value.length - 4, 2))}${visible}`;
}
