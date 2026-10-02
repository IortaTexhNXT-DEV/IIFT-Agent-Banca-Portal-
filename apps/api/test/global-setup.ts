import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import pg from 'pg';
import { TEST_ENV } from './test-env.js';

/**
 * Rebuilds the end-to-end test database and loads reference and demonstration data
 * once per run. As a safeguard it only ever touches a database whose name ends in
 * "_test", so it cannot be pointed at a development or production database by mistake.
 */
export default async function setup(): Promise<void> {
  const databaseName = new URL(TEST_ENV.DATABASE_URL).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to reset "${databaseName}": the e2e database name must end with "_test"`,
    );
  }

  const client = new pg.Client({ connectionString: TEST_ENV.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }

  const env = { ...process.env, ...TEST_ENV };
  const run = (args: string[]) =>
    execFileSync('npx', args, { env, stdio: 'pipe', cwd: process.cwd() });
  rmSync(TEST_ENV.DOCUMENT_STORAGE_PATH, { recursive: true, force: true });
  run(['prisma', 'migrate', 'deploy']);
  run(['node', '--import', '@swc-node/register/esm-register', 'prisma/seed.ts']);
  run(['node', '--import', '@swc-node/register/esm-register', 'prisma/seed-demo.ts']);
}
