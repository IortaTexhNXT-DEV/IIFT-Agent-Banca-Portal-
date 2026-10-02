import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { AppConfig } from '../../config/app-config.js';
import { BusinessRuleError } from '../../common/http/errors.js';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface InspectedFile {
  fileName: string;
  mimeType: string;
  sha256: string;
}

/** File types accepted for upload, identified by their leading "magic" bytes, not by name. */
const SIGNATURES: { mimeType: string; extension: string; bytes: number[] }[] = [
  { mimeType: 'application/pdf', extension: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  {
    mimeType: 'image/png',
    extension: 'png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
];

/**
 * Validates uploads before they are stored: size limit, allowed type by content,
 * safe file name and (when ClamAV is configured) malware scanning.
 */
@Injectable()
export class FileInspector {
  private readonly logger = new Logger(FileInspector.name);

  constructor(private readonly config: AppConfig) {}

  async inspect(file: UploadedFile | undefined): Promise<InspectedFile> {
    if (!file || file.size === 0) {
      throw new BusinessRuleError('FILE_REQUIRED', 'Please choose a file to upload');
    }
    if (file.size > this.config.documents.maxUploadBytes) {
      throw new BusinessRuleError(
        'FILE_TOO_LARGE',
        `File exceeds the ${this.config.documents.maxUploadBytes / 1048576} MB limit`,
      );
    }
    const signature = SIGNATURES.find((candidate) =>
      candidate.bytes.every((byte, index) => file.buffer[index] === byte),
    );
    if (!signature) {
      throw new BusinessRuleError(
        'FILE_TYPE_NOT_ALLOWED',
        'Only PDF, PNG and JPEG files are accepted',
      );
    }
    await this.scanForMalware(file.buffer);
    return {
      fileName: safeFileName(file.originalname, signature.extension),
      mimeType: signature.mimeType,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private async scanForMalware(content: Buffer): Promise<void> {
    const host = this.config.documents.clamavHost;
    if (!host) {
      return;
    }
    const verdict = await clamdInstream(host, this.config.documents.clamavPort, content);
    if (!verdict.endsWith('OK')) {
      this.logger.warn(`Upload rejected by malware scan: ${verdict}`);
      throw new BusinessRuleError('FILE_REJECTED', 'The file was rejected by the security scan');
    }
  }
}

/** Keeps letters, digits, dot, dash and underscore; forces the extension to match the content. */
export function safeFileName(original: string, extension: string): string {
  const base = (original.split(/[\\/]/).pop() ?? '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 100);
  return `${base || 'document'}.${extension}`;
}

/** Streams the content to clamd using the INSTREAM command and returns its verdict line. */
function clamdInstream(host: string, port: number, content: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const chunks: Buffer[] = [];
    socket.setTimeout(30_000, () => socket.destroy(new Error('Malware scan timed out')));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('error', reject);
    socket.on('close', () =>
      resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim()),
    );
    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      const size = Buffer.alloc(4);
      size.writeUInt32BE(content.length, 0);
      socket.write(size);
      socket.write(content);
      socket.end(Buffer.alloc(4));
    });
  });
}
