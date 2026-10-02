import { randomBytes } from 'node:crypto';
import { AppConfig } from './app-config.js';

const key = () => randomBytes(32).toString('base64');
const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(40),
  FIELD_ENCRYPTION_KEY: key(),
  FIELD_HASH_KEY: key(),
  DOCUMENT_ENCRYPTION_KEY: key(),
};

describe('AppConfig', () => {
  it('loads a minimal development configuration with safe defaults', () => {
    const config = new AppConfig({ ...base });
    expect(config.isProduction).toBe(false);
    expect(config.integration.mode).toBe('simulated');
    expect(config.documents.maxUploadBytes).toBe(10 * 1024 * 1024);
  });

  it('fails fast on missing or weak secrets', () => {
    expect(() => new AppConfig({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => new AppConfig({ ...base, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => new AppConfig({ ...base, FIELD_ENCRYPTION_KEY: 'abc' })).toThrow(/32-byte key/);
  });

  it('refuses insecure production settings', () => {
    expect(
      () => new AppConfig({ ...base, NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }),
    ).toThrow(/SESSION_COOKIE_SECURE/);
    expect(
      () => new AppConfig({ ...base, NODE_ENV: 'production', INTEGRATION_MODE: 'live' }),
    ).toThrow(/CORE_API_BASE_URL/);
  });

  it('accepts a complete production configuration', () => {
    const config = new AppConfig({
      ...base,
      NODE_ENV: 'production',
      API_DOCS_ENABLED: 'false',
      CLAMAV_HOST: 'clamav',
    });
    expect(config.session.secureCookie).toBe(true);
  });
});
