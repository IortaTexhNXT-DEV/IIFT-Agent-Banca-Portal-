/**
 * Typed application configuration loaded from environment variables.
 *
 * Every setting the API needs at start-up is read and validated here, so a
 * mis-configured deployment fails fast with a clear message instead of failing
 * later at runtime. Business parameters that operations staff can change
 * (password policy, grace period, SLA hours ...) live in the database instead —
 * see SettingsService.
 */

export type IntegrationMode = 'live' | 'simulated';

/**
 * Sign-in attempts allowed per client IP per minute. Read once at start-up because it
 * is applied through a route decorator; defaults to 10.
 */
export const LOGIN_ATTEMPTS_PER_MINUTE = Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 10);

export interface HttpEndpointConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export class AppConfig {
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly port: number;
  readonly trustProxyHops: number;
  readonly databaseUrl: string;
  readonly databasePoolSize: number;
  readonly corsOrigins: string[];
  readonly publicBaseUrl: string;
  readonly apiDocsEnabled: boolean;

  readonly session: {
    secret: string;
    cookieName: string;
    secureCookie: boolean;
  };

  readonly encryption: {
    fieldKey: Buffer;
    hashKey: Buffer;
    documentKey: Buffer;
  };

  readonly documents: {
    storagePath: string;
    maxUploadBytes: number;
    clamavHost?: string;
    clamavPort: number;
  };

  readonly jobs: {
    enabled: boolean;
    timezone: string;
    eodCron: string;
  };

  readonly integration: {
    mode: IntegrationMode;
    inboundApiKeyHash?: string;
    core?: HttpEndpointConfig;
    finance?: HttpEndpointConfig;
    aml?: HttpEndpointConfig;
    sms?: HttpEndpointConfig & { senderId: string };
  };

  readonly smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };

  readonly directory?: {
    url: string;
    bindDn: string;
    bindPassword: string;
    baseDn: string;
    userFilter: string;
  };

  readonly metricsToken?: string;

  constructor(env: NodeJS.ProcessEnv) {
    const reader = new EnvReader(env);

    this.nodeEnv = reader.string('NODE_ENV', 'development');
    this.isProduction = this.nodeEnv === 'production';
    this.port = reader.int('PORT', 3000);
    this.trustProxyHops = reader.int('TRUST_PROXY_HOPS', 1);
    this.databaseUrl = reader.required('DATABASE_URL');
    this.databasePoolSize = reader.int('DATABASE_POOL_SIZE', 10);
    this.corsOrigins = reader.list('CORS_ORIGINS');
    this.publicBaseUrl = reader.string('PUBLIC_BASE_URL', 'http://localhost:5173');
    this.apiDocsEnabled = reader.bool('API_DOCS_ENABLED', !this.isProduction);

    this.session = {
      secret: reader.secret('SESSION_SECRET', 32),
      cookieName: reader.string('SESSION_COOKIE_NAME', 'iift.sid'),
      secureCookie: reader.bool('SESSION_COOKIE_SECURE', this.isProduction),
    };

    this.encryption = {
      fieldKey: reader.key('FIELD_ENCRYPTION_KEY'),
      hashKey: reader.key('FIELD_HASH_KEY'),
      documentKey: reader.key('DOCUMENT_ENCRYPTION_KEY'),
    };

    this.documents = {
      storagePath: reader.string('DOCUMENT_STORAGE_PATH', './storage/documents'),
      maxUploadBytes: reader.int('MAX_UPLOAD_MB', 10) * 1024 * 1024,
      clamavHost: reader.optional('CLAMAV_HOST'),
      clamavPort: reader.int('CLAMAV_PORT', 3310),
    };

    this.jobs = {
      enabled: reader.bool('JOBS_ENABLED', true),
      timezone: reader.string('JOBS_TIMEZONE', 'Asia/Brunei'),
      eodCron: reader.string('EOD_CRON', '0 30 23 * * *'),
    };

    const mode = reader.string('INTEGRATION_MODE', 'simulated');
    if (mode !== 'live' && mode !== 'simulated') {
      throw new Error(`INTEGRATION_MODE must be "live" or "simulated" (got "${mode}")`);
    }
    this.integration = {
      mode,
      inboundApiKeyHash: reader.optional('INBOUND_API_KEY_SHA256'),
      core: reader.endpoint('CORE_API'),
      finance: reader.endpoint('FINANCE_API'),
      aml: reader.endpoint('AML_API'),
      sms: reader.endpoint('SMS_API')
        ? { ...reader.endpoint('SMS_API')!, senderId: reader.string('SMS_SENDER_ID', 'IIFT') }
        : undefined,
    };

    const smtpHost = reader.optional('SMTP_HOST');
    this.smtp = smtpHost
      ? {
          host: smtpHost,
          port: reader.int('SMTP_PORT', 587),
          secure: reader.bool('SMTP_SECURE', false),
          user: reader.optional('SMTP_USER'),
          password: reader.optional('SMTP_PASSWORD'),
          from: reader.required('SMTP_FROM'),
        }
      : undefined;

    const ldapUrl = reader.optional('LDAP_URL');
    this.directory = ldapUrl
      ? {
          url: ldapUrl,
          bindDn: reader.required('LDAP_BIND_DN'),
          bindPassword: reader.required('LDAP_BIND_PASSWORD'),
          baseDn: reader.required('LDAP_BASE_DN'),
          userFilter: reader.string('LDAP_USER_FILTER', '(sAMAccountName={{username}})'),
        }
      : undefined;

    this.metricsToken = reader.optional('METRICS_TOKEN');

    this.assertProductionReadiness();
  }

  private assertProductionReadiness(): void {
    if (!this.isProduction) {
      return;
    }
    const problems: string[] = [];
    if (!this.session.secureCookie) {
      problems.push('SESSION_COOKIE_SECURE must be true in production');
    }
    if (this.apiDocsEnabled) {
      problems.push('API_DOCS_ENABLED must be false in production');
    }
    if (this.integration.mode === 'live') {
      if (!this.integration.core) problems.push('CORE_API_BASE_URL is required in live mode');
      if (!this.integration.finance) problems.push('FINANCE_API_BASE_URL is required in live mode');
      if (!this.smtp) problems.push('SMTP_HOST is required in live mode');
      if (!this.integration.inboundApiKeyHash) {
        problems.push('INBOUND_API_KEY_SHA256 is required in live mode');
      }
    }
    if (problems.length > 0) {
      throw new Error(`Invalid production configuration:\n - ${problems.join('\n - ')}`);
    }
  }
}

/** Small helper that reads and validates individual environment variables. */
class EnvReader {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  optional(name: string): string | undefined {
    const value = this.env[name]?.trim();
    return value ? value : undefined;
  }

  required(name: string): string {
    const value = this.optional(name);
    if (!value) {
      throw new Error(`Environment variable ${name} is required`);
    }
    return value;
  }

  string(name: string, fallback: string): string {
    return this.optional(name) ?? fallback;
  }

  int(name: string, fallback: number): number {
    const raw = this.optional(name);
    if (raw === undefined) {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Environment variable ${name} must be a non-negative integer`);
    }
    return value;
  }

  bool(name: string, fallback: boolean): boolean {
    const raw = this.optional(name);
    if (raw === undefined) {
      return fallback;
    }
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new Error(`Environment variable ${name} must be true or false`);
  }

  list(name: string): string[] {
    return (this.optional(name) ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  secret(name: string, minLength: number): string {
    const value = this.required(name);
    if (value.length < minLength) {
      throw new Error(`Environment variable ${name} must be at least ${minLength} characters`);
    }
    return value;
  }

  /** 256-bit key supplied as base64. */
  key(name: string): Buffer {
    const key = Buffer.from(this.required(name), 'base64');
    if (key.length !== 32) {
      throw new Error(`Environment variable ${name} must be a base64-encoded 32-byte key`);
    }
    return key;
  }

  endpoint(prefix: string): HttpEndpointConfig | undefined {
    const baseUrl = this.optional(`${prefix}_BASE_URL`);
    if (!baseUrl) {
      return undefined;
    }
    if (!/^https?:\/\//.test(baseUrl)) {
      throw new Error(`${prefix}_BASE_URL must be an http(s) URL`);
    }
    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey: this.required(`${prefix}_API_KEY`),
      timeoutMs: this.int(`${prefix}_TIMEOUT_MS`, 15000),
    };
  }
}
