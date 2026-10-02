import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppConfig } from '../../config/app-config.js';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.bin$/;

/**
 * Encrypted document store (COM-06, NFR-08). Files are encrypted with AES-256-GCM
 * before they reach the disk and are addressed only by generated keys, so user
 * input can never influence a file-system path. The directory can be local disk,
 * a SAN/NFS mount (on-premise) or a mounted object-storage volume (cloud).
 */
@Injectable()
export class DocumentStorage {
  private readonly root: string;
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.root = path.resolve(config.documents.storagePath);
    this.key = config.encryption.documentKey;
  }

  async write(content: Buffer): Promise<string> {
    const now = new Date();
    const storageKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.bin`;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    const target = this.resolve(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const data = await readFile(this.resolve(storageKey));
    const decipher = createDecipheriv('aes-256-gcm', this.key, data.subarray(0, IV_LENGTH));
    decipher.setAuthTag(data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([
      decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)),
      decipher.final(),
    ]);
  }

  private resolve(storageKey: string): string {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      throw new Error('Invalid storage key');
    }
    return path.join(this.root, storageKey);
  }
}
