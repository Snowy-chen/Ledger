import {
  periodOf,
  toIsoDate,
  type Balance,
  type Period,
  type Summary,
  type Transaction,
  type TransactionInput,
  type Trend,
} from '@expense/shared';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { api } from '../api/client';

/** How many months the 统计 chart shows. A fixed window, not a user setting. */
export const TREND_MONTHS = 6;

/** The current natural month, e.g. `"2026-10"`. */
function currentPeriod(): Period {
  return periodOf(toIsoDate(new Date()));
}

function isAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

/**
 * Global transaction state and the operations that change it.
 *
 * This store may call the API, but only through `api/client.ts` — never
 * `fetch` directly. It owns no UI state and knows nothing about when the
 * screen appears; that is the composable's job.
 */
export const useTransactionStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([]);
  const summary = ref<Summary | null>(null);
  const balance = ref<Balance | null>(null);
  const trend = ref<Trend | null>(null);
  const period = ref<Period>(currentPeriod());
  const loading = ref(false);
  const error = ref<string | null>(null);
  /**
   * Everything the home screen and the 统计 panel read, in one round trip.
   *
   * They are fetched together rather than per-screen because the balance is
   * all-time and the summary is per-period: switching period invalidates both
   * the card and the list at once, and a half-updated screen would show a
   * total that does not match the rows beneath it.
   */
  async function load(signal?: AbortSignal): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const [list, totals, running, history] = await Promise.all([
        api.listTransactions(period.value, signal),
        api.getSummary(period.value, signal),
        api.getBalance(signal),
        api.getTrend(period.value, TREND_MONTHS, signal),
      ]);
      transactions.value = list;
      summary.value = totals;
      balance.value = running;
      trend.value = history;
    } catch (cause) {
      if (isAbort(cause)) {
        return; // The screen is gone. Nobody is waiting for this answer.
      }
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading.value = false;
    }
  }

  async function add(input: TransactionInput): Promise<void> {
    await api.createTransaction(input);
    await load();
  }

  async function remove(id: string): Promise<void> {
    await api.deleteTransaction(id);
    await load();
  }

  function setPeriod(next: Period): void {
    period.value = next;
    void load();
  }

  return {
    transactions,
    summary,
    balance,
    trend,
    period,
    loading,
    error,
    load,
    add,
    remove,
    setPeriod,
  };
});
