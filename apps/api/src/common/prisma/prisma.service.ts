import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../config/app-config.js';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';

/** Either the root client or the client bound to an open transaction. */
export type Db = PrismaService | Prisma.TransactionClient;

const JOB_LOCK_MAX_DURATION_MS = 30 * 60 * 1000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        max: config.databasePoolSize,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs `work` only if this process obtains a transaction-scoped advisory lock.
   * Used by scheduled jobs so that only one API replica executes a job at a time.
   * The lock is held by a dedicated transaction for the duration of the work and
   * is released automatically when that transaction ends, even if the process dies.
   * Returns false when another replica already holds the lock.
   */
  async withJobLock(lockName: string, work: () => Promise<void>): Promise<boolean> {
    return this.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${lockName})) AS locked`;
        if (!locked) {
          return false;
        }
        await work();
        return true;
      },
      { timeout: JOB_LOCK_MAX_DURATION_MS, maxWait: 10_000 },
    );
  }
}
