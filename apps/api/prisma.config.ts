import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import @swc-node/register/esm-register prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
