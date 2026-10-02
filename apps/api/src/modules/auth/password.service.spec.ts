import type { SettingsService } from '../settings/settings.service.js';
import { PasswordService } from './password.service.js';

const settings = {
  getInt: async (key: string) =>
    key.endsWith('min_length') ? 12 : key.endsWith('expiry_days') ? 90 : 5,
  getBool: async () => true,
} as unknown as SettingsService;

const passwords = new PasswordService(settings);

async function problems(password: string, username = 'ag-000001'): Promise<string[]> {
  try {
    await passwords.assertMeetsPolicy(password, username);
    return [];
  } catch (error) {
    return (error as { response: { details: string[] } }).response.details;
  }
}

describe('PasswordService', () => {
  it('accepts a password meeting every rule', async () => {
    expect(await problems('Brunei#Takaful26')).toEqual([]);
  });

  it('reports every unmet rule together', async () => {
    expect(await problems('short')).toEqual([
      'At least 12 characters',
      'An upper-case letter',
      'A digit',
      'A symbol',
    ]);
  });

  it('rejects passwords containing the username', async () => {
    expect(await problems('Xx!9ag-000001xx')).toContain('Must not contain your username');
  });

  it('hashes with Argon2id and verifies', async () => {
    const hash = await passwords.hash('Brunei#Takaful26');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await passwords.verify(hash, 'Brunei#Takaful26')).toBe(true);
    expect(await passwords.verify(hash, 'wrong')).toBe(false);
    expect(await passwords.verify('not-a-hash', 'x')).toBe(false);
  });

  it('expires passwords after the configured number of days', async () => {
    expect(await passwords.isExpired(new Date(Date.now() - 91 * 86_400_000))).toBe(true);
    expect(await passwords.isExpired(new Date())).toBe(false);
  });

  it('generates temporary passwords that satisfy the policy', async () => {
    for (let i = 0; i < 50; i++) {
      expect(await problems(passwords.generateTemporary(), 'someone')).toEqual([]);
    }
  });
});
