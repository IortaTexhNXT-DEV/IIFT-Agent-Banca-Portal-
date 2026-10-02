import type { AppConfig } from '../../config/app-config.js';
import { FileInspector, safeFileName } from './file-inspector.js';

const inspector = new FileInspector({
  documents: { maxUploadBytes: 1024, clamavPort: 3310 },
} as AppConfig);
const file = (bytes: number[], name = 'scan.pdf', size?: number) => {
  const buffer = Buffer.from([...bytes, 0, 0, 0]);
  return {
    originalname: name,
    mimetype: 'application/octet-stream',
    size: size ?? buffer.length,
    buffer,
  };
};

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
}

describe('FileInspector', () => {
  it('identifies files by content and forces a matching extension', async () => {
    const result = await inspector.inspect(
      file([0x25, 0x50, 0x44, 0x46, 0x2d], 'payment proof.exe'),
    );
    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toBe('payment_proof.pdf');
    expect(result.sha256).toHaveLength(64);
  });

  it('rejects content that is not PDF, PNG or JPEG whatever its name', async () => {
    expect(await codeOf(inspector.inspect(file([0x4d, 0x5a, 0x90], 'invoice.pdf')))).toBe(
      'FILE_TYPE_NOT_ALLOWED',
    );
  });

  it('enforces the size limit and requires a file', async () => {
    expect(await codeOf(inspector.inspect(file([0xff, 0xd8, 0xff], 'a.jpg', 2048)))).toBe(
      'FILE_TOO_LARGE',
    );
    expect(await codeOf(inspector.inspect(undefined))).toBe('FILE_REQUIRED');
  });

  it('builds safe file names', () => {
    expect(safeFileName('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
    expect(safeFileName('C:\\Users\\me\\IC copy (front).jpeg', 'jpg')).toBe('IC_copy_front_.jpg');
    expect(safeFileName('', 'png')).toBe('document.png');
  });
});
