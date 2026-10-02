import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { BusinessRuleError } from '../../common/http/errors.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';

/** Argon2id parameters following the OWASP password storage recommendation. */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** Used to keep response time constant when the username does not exist. */
const DUMMY_HASH_INPUT = 'timing-equaliser-not-a-real-password';

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  constructor(private readonly settings: SettingsService) {}

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Performs a hash verification with no possible match, to equalise timing. */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash(DUMMY_HASH_INPUT);
    await this.verify(await this.dummyHash, password);
  }

  /** Throws with every unmet rule so the user can fix them all at once (AP-02). */
  async assertMeetsPolicy(password: string, username: string): Promise<void> {
    const problems: string[] = [];
    const minLength = await this.settings.getInt(Setting.PasswordMinLength);
    if (password.length < minLength) problems.push(`At least ${minLength} characters`);
    if (password.length > 128) problems.push('At most 128 characters');
    if ((await this.settings.getBool(Setting.PasswordRequireUpper)) && !/[A-Z]/.test(password)) {
      problems.push('An upper-case letter');
    }
    if ((await this.settings.getBool(Setting.PasswordRequireLower)) && !/[a-z]/.test(password)) {
      problems.push('A lower-case letter');
    }
    if ((await this.settings.getBool(Setting.PasswordRequireDigit)) && !/\d/.test(password)) {
      problems.push('A digit');
    }
    if (
      (await this.settings.getBool(Setting.PasswordRequireSymbol)) &&
      !/[^A-Za-z0-9]/.test(password)
    ) {
      problems.push('A symbol');
    }
    if (password.toLowerCase().includes(username.toLowerCase())) {
      problems.push('Must not contain your username');
    }
    if (problems.length > 0) {
      throw new BusinessRuleError(
        'PASSWORD_POLICY',
        'Password does not meet the password policy',
        problems,
      );
    }
  }

  async assertNotRecentlyUsed(db: Db, userId: string, password: string): Promise<void> {
    const historyCount = await this.settings.getInt(Setting.PasswordHistoryCount);
    if (historyCount === 0) {
      return;
    }
    const recent = await db.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: historyCount,
      select: { passwordHash: true },
    });
    for (const entry of recent) {
      if (await this.verify(entry.passwordHash, password)) {
        throw new BusinessRuleError(
          'PASSWORD_REUSED',
          `You cannot reuse any of your last ${historyCount} passwords`,
        );
      }
    }
  }

  async isExpired(passwordChangedAt: Date | null): Promise<boolean> {
    const expiryDays = await this.settings.getInt(Setting.PasswordExpiryDays);
    if (expiryDays === 0 || !passwordChangedAt) {
      return false;
    }
    return Date.now() - passwordChangedAt.getTime() > expiryDays * 86_400_000;
  }

  /** Temporary password issued by an administrator; always forces a change at next login. */
  generateTemporary(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols = '!@#$%*?';
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    const symbol = symbols[bytes[0] % symbols.length];
    return `${body.slice(0, 4).toUpperCase()}${body.slice(4).toLowerCase()}${symbol}${(bytes[1] % 90) + 10}`;
  }
}
