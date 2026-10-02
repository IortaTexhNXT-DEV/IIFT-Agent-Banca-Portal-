import { describe, expect, it } from 'vitest';
import { withoutCiphertext } from './workflow.service.js';

describe('withoutCiphertext', () => {
  it('removes encrypted values at any depth and keeps everything else', () => {
    const request = {
      id: 'r1',
      payload: {
        policyNo: 'PRO/26/000001',
        nominees: [
          { fullName: 'Kamal bin Ali', idNumberEnc: 'v1:abc', idNumberMasked: '00-***233' },
        ],
        participant: { idNumberEnc: 'v1:def', fullName: 'Aminah' },
      },
    };
    expect(withoutCiphertext(request)).toEqual({
      id: 'r1',
      payload: {
        policyNo: 'PRO/26/000001',
        nominees: [{ fullName: 'Kamal bin Ali', idNumberMasked: '00-***233' }],
        participant: { fullName: 'Aminah' },
      },
    });
  });

  it('leaves scalar and empty payloads untouched', () => {
    expect(withoutCiphertext({ payload: null }).payload).toBeNull();
    expect(withoutCiphertext({ payload: 'text' }).payload).toBe('text');
  });
});
