import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ConfigParameter } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { SETTING_DEFAULTS, type SettingKey } from './setting-keys.js';

const CACHE_TTL_MS = 30_000;

/**
 * Typed access to administrator-maintained parameters. Values are cached for a short
 * time so hot paths (every request checks the session timeout) do not hit the database.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, ConfigParameter>();
  private loadedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Inserts defaults for any parameter that does not exist yet; never overwrites. */
  async onModuleInit(): Promise<void> {
    const result = await this.prisma.configParameter.createMany({
      data: SETTING_DEFAULTS.map((item) => ({
        key: item.key,
        value: item.value,
        valueType: item.valueType,
        category: item.category,
        description: item.description,
        minValue: item.min ?? null,
        maxValue: item.max ?? null,
      })),
      skipDuplicates: true,
    });
    if (result.count > 0) {
      this.logger.log(`Initialised ${result.count} system parameter(s) with default values`);
    }
  }

  async list(): Promise<ConfigParameter[]> {
    return this.prisma.configParameter.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
  }

  async getInt(key: SettingKey): Promise<number> {
    return Number((await this.get(key)).value);
  }

  async getDecimal(key: SettingKey): Promise<number> {
    return Number((await this.get(key)).value);
  }

  async getBool(key: SettingKey): Promise<boolean> {
    return (await this.get(key)).value === 'true';
  }

  async update(key: string, rawValue: string): Promise<ConfigParameter> {
    const existing = await this.prisma.configParameter.findUnique({ where: { key } });
    if (!existing) {
      throw notFound('Parameter');
    }
    const value = normaliseValue(existing, rawValue);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.configParameter.update({ where: { key }, data: { value } });
      await this.audit.record(
        {
          action: 'PARAMETER_UPDATED',
          entityType: 'ConfigParameter',
          entityId: key,
          before: { value: existing.value },
          after: { value },
        },
        tx,
      );
      return saved;
    });
    this.loadedAt = 0;
    return updated;
  }

  private async get(key: SettingKey): Promise<ConfigParameter> {
    if (Date.now() - this.loadedAt > CACHE_TTL_MS) {
      const rows = await this.prisma.configParameter.findMany();
      this.cache = new Map(rows.map((row) => [row.key, row]));
      this.loadedAt = Date.now();
    }
    const parameter = this.cache.get(key);
    if (!parameter) {
      throw new Error(`System parameter ${key} is missing`);
    }
    return parameter;
  }
}

function normaliseValue(parameter: ConfigParameter, rawValue: string): string {
  const value = rawValue.trim();
  switch (parameter.valueType) {
    case 'BOOLEAN':
      if (value !== 'true' && value !== 'false') {
        throw new BusinessRuleError('INVALID_PARAMETER', 'Value must be true or false');
      }
      return value;
    case 'INTEGER':
    case 'DECIMAL': {
      const numeric = Number(value);
      const isValid =
        parameter.valueType === 'INTEGER' ? Number.isInteger(numeric) : Number.isFinite(numeric);
      if (value === '' || !isValid) {
        throw new BusinessRuleError(
          'INVALID_PARAMETER',
          `Value must be a ${parameter.valueType.toLowerCase()}`,
        );
      }
      if (parameter.minValue !== null && numeric < Number(parameter.minValue)) {
        throw new BusinessRuleError(
          'INVALID_PARAMETER',
          `Value must be at least ${parameter.minValue.toString()}`,
        );
      }
      if (parameter.maxValue !== null && numeric > Number(parameter.maxValue)) {
        throw new BusinessRuleError(
          'INVALID_PARAMETER',
          `Value must be at most ${parameter.maxValue.toString()}`,
        );
      }
      return String(numeric);
    }
    default:
      if (value.length === 0) {
        throw new BusinessRuleError('INVALID_PARAMETER', 'Value is required');
      }
      return value;
  }
}
