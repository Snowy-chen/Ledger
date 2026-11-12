import {
  BalanceSchema,
  SummarySchema,
  TransactionSchema,
  TrendSchema,
  type Balance,
  type Period,
  type Summary,
  type Transaction,
  type TransactionInput,
  type Trend,
} from '@expense/shared';
import { z } from 'zod';

/**
 * The single network exit of the web app. Nothing else may call `fetch`
 * (see CLAUDE.md).
 *
 * Routing every request through here buys one thing: each response is parsed
 * against the *same* schema the API validates with, because both sides import
 * it from `@expense/shared`. A contract drift therefore fails loudly in the
 * browser instead of quietly corrupting the UI.
 */

const TransactionListSchema = z.strictObject({ transactions: z.array(TransactionSchema) });

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  return response;
}

async function sendJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await send(path, init);
  return schema.parse(await response.json());
}

export const api = {
  async listTransactions(period: Period, signal?: AbortSignal): Promise<Transaction[]> {
    const body = await sendJson(
      `/api/transactions?period=${encodeURIComponent(period)}`,
      TransactionListSchema,
      { signal },
    );
    return body.transactions;
  },

  createTransaction(input: TransactionInput, signal?: AbortSignal): Promise<Transaction> {
    return sendJson('/api/transactions', TransactionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
  },

  async deleteTransaction(id: string, signal?: AbortSignal): Promise<void> {
    await send(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
  },

  getSummary(period: Period, signal?: AbortSignal): Promise<Summary> {
    return sendJson(`/api/summary?period=${encodeURIComponent(period)}`, SummarySchema, { signal });
  },

  getBalance(signal?: AbortSignal): Promise<Balance> {
    return sendJson('/api/balance', BalanceSchema, { signal });
  },

  getTrend(period: Period, months: number, signal?: AbortSignal): Promise<Trend> {
    const query = `period=${encodeURIComponent(period)}&months=${months}`;
    return sendJson(`/api/trend?${query}`, TrendSchema, { signal });
  },
};
