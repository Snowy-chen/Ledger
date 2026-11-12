import { randomUUID } from 'node:crypto';

import {
  periodBounds,
  recentPeriods,
  type Balance,
  type Kind,
  type Period,
  type Summary,
  type Transaction,
  type TransactionInput,
  type Trend,
} from '@expense/shared';

import type { KindTotal, TransactionRepository } from '../repositories/transaction-repository.js';

/**
 * Domain operations on transactions.
 *
 * Knows nothing about HTTP: there is no Koa `ctx` in this file (see
 * CLAUDE.md). That is what lets the API integration tests and any future
 * caller share exactly one implementation.
 */
export interface TransactionService {
  record(input: TransactionInput): Transaction;
  list(period: Period): Transaction[];
  remove(id: string): boolean;
  summarize(period: Period): Summary;
  balance(): Balance;
  trend(period: Period, months: number): Trend;
}

/** The first day of the month, which is what `periodBounds` expects. */
function firstOf(period: Period): string {
  return `${period}-01`;
}

/** A direction that saw no movement totals zero, not undefined. */
function totalOf(totals: readonly KindTotal[], kind: Kind): number {
  return totals.find((total) => total.kind === kind)?.totalCents ?? 0;
}

/** Net is signed: a period may cost more than it earned. */
function netOf(incomeCents: number, expenseCents: number): number {
  return incomeCents - expenseCents;
}

export function createTransactionService(
  repository: TransactionRepository,
): TransactionService {
  return {
    record(input) {
      const recordedAt = new Date().toISOString();
      const id = randomUUID();

      // Narrowing on `kind` is what keeps the category honest: the union makes
      // it impossible to build an income that carries one.
      const transaction: Transaction =
        input.kind === 'expense'
          ? {
              id,
              kind: 'expense',
              amountCents: input.amountCents,
              category: input.category,
              occurredOn: input.occurredOn,
              note: input.note ?? null,
              recordedAt,
            }
          : {
              id,
              kind: 'income',
              amountCents: input.amountCents,
              category: null,
              occurredOn: input.occurredOn,
              note: input.note ?? null,
              recordedAt,
            };

      repository.insert(transaction);
      return transaction;
    },

    list(period) {
      const { from, to } = periodBounds(firstOf(period));
      return repository.listBetween(from, to);
    },

    remove(id) {
      return repository.deleteById(id);
    },

    summarize(period) {
      const { from, to } = periodBounds(firstOf(period));
      const byCategory = repository.expenseTotalsByCategory(from, to);
      const totals = repository.totalsByKindBetween(from, to);
      const incomeCents = totalOf(totals, 'income');
      const expenseCents = totalOf(totals, 'expense');

      return {
        period,
        expenseCents,
        incomeCents,
        netCents: netOf(incomeCents, expenseCents),
        byCategory,
      };
    },

    balance() {
      const totals = repository.totalsByKindOverall();
      const incomeCents = totalOf(totals, 'income');
      const expenseCents = totalOf(totals, 'expense');

      return { incomeCents, expenseCents, netCents: netOf(incomeCents, expenseCents) };
    },

    trend(period, months) {
      const periods = recentPeriods(period, months);
      const first = periods[0];
      const last = periods[periods.length - 1];

      if (first === undefined || last === undefined) {
        return { periods: [] };
      }

      // One range query for the whole window, rather than one per month.
      const from = periodBounds(firstOf(first)).from;
      const to = periodBounds(firstOf(last)).to;
      const rows = repository.periodTotalsBetween(from, to);

      // Months with no rows are filled in with zeros so the chart keeps an
      // even x-axis instead of skipping the quiet months.
      return {
        periods: periods.map((month) => {
          const inMonth = rows.filter((row) => row.period === month);
          return {
            period: month,
            expenseCents: totalOf(inMonth, 'expense'),
            incomeCents: totalOf(inMonth, 'income'),
          };
        }),
      };
    },
  };
}
