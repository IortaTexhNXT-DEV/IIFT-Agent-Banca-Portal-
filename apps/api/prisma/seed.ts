/**
 * Reference data required in every environment (roles, workflows, master data,
 * products and the first administrator). Safe to run repeatedly: existing records,
 * including any changes administrators made, are left untouched.
 *
 *   SEED_ADMIN_PASSWORD='<temporary password>' npm run db:seed
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { ARGON2_OPTIONS } from '../src/modules/auth/password.service.js';
import { CODES } from './reference-data/codes.js';
import { PRODUCTS } from './reference-data/products.js';
import { ROLES } from './reference-data/roles.js';
import { WORKFLOWS } from './reference-data/workflows.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedRoles(): Promise<void> {
  for (const role of ROLES) {
    const existing = await prisma.role.findUnique({ where: { code: role.code } });
    if (existing) continue;
    await prisma.role.create({
      data: {
        code: role.code,
        name: role.name,
        description: role.description,
        audience: role.audience,
        isSystem: true,
        permissions: { create: role.permissions.map((permission) => ({ permission })) },
      },
    });
  }
}

async function seedWorkflows(): Promise<void> {
  for (const workflow of WORKFLOWS) {
    const existing = await prisma.workflowDefinition.findUnique({ where: { type: workflow.type } });
    if (existing) continue;
    await prisma.workflowDefinition.create({
      data: {
        type: workflow.type,
        name: workflow.name,
        description: workflow.description,
        steps: {
          create: workflow.steps.map((step, index) => ({
            level: index + 1,
            name: step.name,
            permission: step.permission,
            minAmount: step.minAmount ?? null,
          })),
        },
      },
    });
  }
}

async function seedCodes(): Promise<void> {
  const data = Object.entries(CODES).flatMap(([category, items]) =>
    items.map(([code, label], index) => ({ category, code, label, sortOrder: index + 1 })),
  );
  await prisma.codeItem.createMany({ data, skipDuplicates: true });
}

async function seedProducts(): Promise<void> {
  for (const product of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { code: product.code } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        ...product,
        config: product.config as Prisma.InputJsonValue,
        requiredDocuments: product.requiredDocuments as Prisma.InputJsonValue,
        questionnaire: product.questionnaire as Prisma.InputJsonValue,
      },
    });
  }
}

async function seedAdministrator(): Promise<void> {
  const staffCount = await prisma.user.count({ where: { userType: 'STAFF' } });
  if (staffCount > 0) return;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'Set SEED_ADMIN_PASSWORD (at least 12 characters) to create the first administrator',
    );
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'SYSTEM_ADMINISTRATOR' } });
  await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'System Administrator',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@localhost',
      userType: 'STAFF',
      passwordHash: await hash(password, ARGON2_OPTIONS),
      mustChangePassword: true,
      roles: { create: { roleId: role.id } },
    },
  });
  process.stdout.write(
    'Created administrator "admin" (password change required at first sign-in)\n',
  );
}

async function main(): Promise<void> {
  await seedRoles();
  await seedWorkflows();
  await seedCodes();
  await seedProducts();
  await seedAdministrator();
  process.stdout.write('Reference data is up to date\n');
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seeding failed: ${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
