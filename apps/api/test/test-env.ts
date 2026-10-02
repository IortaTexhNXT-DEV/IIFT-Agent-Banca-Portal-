/**
 * Environment for the end-to-end suite. It always targets a dedicated test database
 * (default iift_test) which the global set-up rebuilds from the migrations.
 * The keys below are fixed test values, never used outside this suite.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://iift:iift_dev_pw@127.0.0.1:5432/iift_test';
export const DEMO_PASSWORD = 'Demo@IIFT2026!';
export const INBOUND_API_KEY = 'e2e-inbound-key';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: 'e2e-session-secret-0123456789abcdef0123456789',
  SESSION_COOKIE_SECURE: 'false',
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  FIELD_HASH_KEY: Buffer.alloc(32, 2).toString('base64'),
  DOCUMENT_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
  DOCUMENT_STORAGE_PATH: './storage/e2e-documents',
  INTEGRATION_MODE: 'simulated',
  JOBS_ENABLED: 'false',
  INBOUND_API_KEY_SHA256: '3ea5e38f3d76bc0dc7ececc0ae2ce845fe6aa3445397beb60a20bf7abae973ad',
  LOG_LEVEL: 'silent',
  LOGIN_RATE_LIMIT_PER_MINUTE: '1000',
  SEED_ADMIN_PASSWORD: 'Temp#Admin2026x',
  DEMO_PASSWORD,
};
