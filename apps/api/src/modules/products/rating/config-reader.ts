/**
 * Small helper for validating product configuration JSON maintained by administrators.
 * Errors name the exact path so a bad value is easy to find.
 */
export class ConfigReader {
  constructor(
    private readonly value: unknown,
    private readonly path = 'config',
  ) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${path} must be an object`);
    }
  }

  private get record(): Record<string, unknown> {
    return this.value as Record<string, unknown>;
  }

  number(key: string, options: { min?: number; max?: number; optional?: boolean } = {}): number {
    const raw = this.record[key];
    if (raw === undefined && options.optional) {
      return Number.NaN;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      throw new Error(`${this.path}.${key} must be a number`);
    }
    if (options.min !== undefined && raw < options.min)
      throw new Error(`${this.path}.${key} must be ≥ ${options.min}`);
    if (options.max !== undefined && raw > options.max)
      throw new Error(`${this.path}.${key} must be ≤ ${options.max}`);
    return raw;
  }

  string(key: string, allowed?: string[]): string {
    const raw = this.record[key];
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new Error(`${this.path}.${key} must be a non-empty string`);
    }
    if (allowed && !allowed.includes(raw)) {
      throw new Error(`${this.path}.${key} must be one of ${allowed.join(', ')}`);
    }
    return raw;
  }

  optionalArray(key: string): ConfigReader[] {
    return this.record[key] === undefined ? [] : this.array(key);
  }

  array(key: string): ConfigReader[] {
    const raw = this.record[key];
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`${this.path}.${key} must be a non-empty array`);
    }
    return raw.map((item, index) => new ConfigReader(item, `${this.path}.${key}[${index}]`));
  }

  numberArray(key: string): number[] {
    const raw = this.record[key];
    if (!Array.isArray(raw) || raw.length === 0 || raw.some((item) => typeof item !== 'number')) {
      throw new Error(`${this.path}.${key} must be a non-empty array of numbers`);
    }
    return raw as number[];
  }

  stringArray(key: string): string[] {
    const raw = this.record[key];
    if (!Array.isArray(raw) || raw.length === 0 || raw.some((item) => typeof item !== 'string')) {
      throw new Error(`${this.path}.${key} must be a non-empty array of text values`);
    }
    return raw as string[];
  }

  child(key: string, optional = false): ConfigReader | undefined {
    const raw = this.record[key];
    if (raw === undefined && optional) {
      return undefined;
    }
    return new ConfigReader(raw, `${this.path}.${key}`);
  }

  has(key: string): boolean {
    return this.record[key] !== undefined;
  }
}
