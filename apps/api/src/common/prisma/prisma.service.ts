import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../config/app-config.js';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';

/** Either the root client or the client bound to an open transaction. */
export type Db = PrismaService | Prisma.TransactionClient;

const JOB_LOCK_MAX_DURATION_MS = 30 * 60 * 1000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, BeforeApplicationShutdown, OnApplicationShutdown
{
  private shuttingDown = false;
  private readonly runningJobs = new Set<Promise<boolean>>();

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

  /** No new job batches once shutdown has begun; in-flight batches run to completion. */
  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(this.runningJobs);
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
    if (this.shuttingDown) {
      return false;
    }
    const job = this.$transaction(
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
    this.runningJobs.add(job);
    try {
      return await job;
    } finally {
      this.runningJobs.delete(job);
    }
  }
}
