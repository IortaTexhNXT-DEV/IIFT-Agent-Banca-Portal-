import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfig, type HttpEndpointConfig } from '../../config/app-config.js';
import { CoreOperation, FinanceOperation } from './outbox.service.js';

export interface DeliveryReceipt {
  reference: string;
  simulated: boolean;
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Minimal JSON-over-HTTPS client used by the gateways. Every call carries the API key,
 * an idempotency key (so a retried message is not processed twice by the receiver)
 * and a hard timeout.
 */
async function postJson(
  endpoint: HttpEndpointConfig,
  path: string,
  body: unknown,
  idempotencyKey: string,
): Promise<DeliveryReceipt> {
  let response: Response;
  try {
    response = await fetch(`${endpoint.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': endpoint.apiKey,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(endpoint.timeoutMs),
    });
  } catch (error) {
    throw new IntegrationError(`Connection failed: ${(error as Error).message}`, true);
  }
  if (!response.ok) {
    // 4xx (other than 408/429) means the message itself is wrong; retrying will not help.
    const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
    throw new IntegrationError(`HTTP ${response.status} from ${path}`, retryable);
  }
  const result = (await response.json().catch(() => ({}))) as { reference?: string; id?: string };
  return { reference: result.reference ?? result.id ?? idempotencyKey, simulated: false };
}

async function getJson<T>(endpoint: HttpEndpointConfig, path: string): Promise<T> {
  const response = await fetch(`${endpoint.baseUrl}${path}`, {
    headers: { accept: 'application/json', 'x-api-key': endpoint.apiKey },
    signal: AbortSignal.timeout(endpoint.timeoutMs),
  });
  if (!response.ok) {
    throw new IntegrationError(`HTTP ${response.status} from ${path}`, response.status >= 500);
  }
  return (await response.json()) as T;
}

function simulated(): DeliveryReceipt {
  return { reference: `SIM-${randomUUID().slice(0, 8)}`, simulated: true };
}

const CORE_PATHS: Record<string, string> = {
  [CoreOperation.AgentUpsert]: '/agents',
  [CoreOperation.ParticipantUpsert]: '/participants',
  [CoreOperation.PolicyIssued]: '/policies',
  [CoreOperation.PolicyEndorsed]: '/policies/endorsements',
  [CoreOperation.PolicyCancelled]: '/policies/cancellations',
  [CoreOperation.ClaimNotified]: '/claims',
};

const FINANCE_PATHS: Record<string, string> = {
  [FinanceOperation.ReceiptPosted]: '/receipts',
  [FinanceOperation.RefundRequested]: '/refunds',
  [FinanceOperation.CommissionAccrued]: '/commissions',
  [FinanceOperation.EodPosting]: '/eod-postings',
};

/** Core takaful system (INT-01..03). */
@Injectable()
export class CoreSystemGateway {
  constructor(private readonly config: AppConfig) {}

  async deliver(
    operation: string,
    payload: unknown,
    idempotencyKey: string,
  ): Promise<DeliveryReceipt> {
    const path = CORE_PATHS[operation];
    if (!path) {
      throw new IntegrationError(`Unknown core operation ${operation}`, false);
    }
    const endpoint = this.config.integration.core;
    if (this.config.integration.mode === 'simulated' || !endpoint) {
      return simulated();
    }
    return postJson(endpoint, path, payload, idempotencyKey);
  }
}

export interface FinancePostingTotals {
  count: number;
  amount: string;
  references: string[];
}

/** Financial system / FIN (INT-04/05, EOD posting and BRR reconciliation). */
@Injectable()
export class FinanceGateway {
  constructor(private readonly config: AppConfig) {}

  get isSimulated(): boolean {
    return this.config.integration.mode === 'simulated' || !this.config.integration.finance;
  }

  async deliver(
    operation: string,
    payload: unknown,
    idempotencyKey: string,
  ): Promise<DeliveryReceipt> {
    const path = FINANCE_PATHS[operation];
    if (!path) {
      throw new IntegrationError(`Unknown finance operation ${operation}`, false);
    }
    if (this.isSimulated) {
      return simulated();
    }
    return postJson(this.config.integration.finance!, path, payload, idempotencyKey);
  }

  /** Receipts the financial system has posted for a business date (used for reconciliation). */
  async postedReceipts(businessDate: string): Promise<FinancePostingTotals> {
    return getJson<FinancePostingTotals>(
      this.config.integration.finance!,
      `/receipts/posted?date=${encodeURIComponent(businessDate)}`,
    );
  }
}
