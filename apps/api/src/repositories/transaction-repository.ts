import {
  CategoryTotalSchema,
  KindSchema,
  TransactionSchema,
  type CategoryTotal,
  type Kind,
  type Transaction,
} from '@expense/shared';

import type { Db } from '../db/index.js';

/**
 * The shape SQLite actually gives back: snake_case, and untyped as far as
 * TypeScript is concerned. The repository is the only place that knows about
 * it — everything above this file sees the camelCase domain types.
 */
interface TransactionRow {
  id: string;
  kind: string;
  amount_cents: number;
  category: string | null;
  occurred_on: string;
  note: string | null;
  recorded_at: string;
}

interface CategoryTotalRow {
  category: string;
  total_cents: number;
}

interface KindTotalRow {
  kind: string;
  total_cents: number;
}

interface PeriodKindTotalRow {
  period: string;
  kind: string;
  total_cents: number;
}

/** How much of one direction of money moved, over some range. */
export interface KindTotal {
  kind: Kind;
  totalCents: number;
}

/** One month of the trend, split by direction. */
export interface PeriodKindTotal {
  period: string;
  kind: Kind;
  totalCents: number;
}

export interface TransactionRepository {
  insert(transaction: Transaction): void;
  listBetween(from: string, to: string): Transaction[];
  deleteById(id: string): boolean;
  expenseTotalsByCategory(from: string, to: string): CategoryTotal[];
  totalsByKindBetween(from: string, to: string): KindTotal[];
  totalsByKindOverall(): KindTotal[];
  periodTotalsBetween(from: string, to: string): PeriodKindTotal[];
}

const COLUMNS = 'id, kind, amount_cents, category, occurred_on, note, recorded_at';

/**
 * Translate a database row into the domain type.
 *
 * Parsing rather than casting means a row that breaks the contract (a float
 * amount smuggled in by hand, say) fails loudly here instead of leaking upward.
 */
function toTransaction(row: TransactionRow): Transaction {
  return TransactionSchema.parse({
    id: row.id,
    kind: row.kind,
    amountCents: row.amount_cents,
    category: row.category,
    occurredOn: row.occurred_on,
    note: row.note,
    recordedAt: row.recorded_at,
  });
}

/** Parses `kind` on the way out, so an unknown value cannot reach the service. */
function toKindTotal(row: KindTotalRow): KindTotal {
  return { kind: KindSchema.parse(row.kind), totalCents: row.total_cents };
}

export function createTransactionRepository(db: Db): TransactionRepository {
  /** Shared by the ranged and overall variants; `where` is ours, never input. */
  function totalsByKind(where: string, ...params: string[]): KindTotal[] {
    const rows = db
      .prepare(
        `SELECT kind, SUM(amount_cents) AS total_cents
           FROM transactions
          ${where}
          GROUP BY kind`,
      )
      .all(...params) as KindTotalRow[];

    return rows.map(toKindTotal);
  }

  return {
    insert(transaction) {
      db.prepare(
        `INSERT INTO transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        transaction.id,
        transaction.kind,
        transaction.amountCents,
        transaction.category,
        transaction.occurredOn,
        transaction.note,
        transaction.recordedAt,
      );
    },

    listBetween(from, to) {
      const rows = db
        .prepare(
          `SELECT ${COLUMNS}
             FROM transactions
            WHERE occurred_on BETWEEN ? AND ?
            ORDER BY occurred_on DESC, recorded_at DESC`,
        )
        .all(from, to) as TransactionRow[];

      return rows.map(toTransaction);
    },

    deleteById(id) {
      const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      return result.changes > 0;
    },

    expenseTotalsByCategory(from, to) {
      const rows = db
        .prepare(
          `SELECT category, SUM(amount_cents) AS total_cents
             FROM transactions
            WHERE kind = 'expense' AND occurred_on BETWEEN ? AND ?
            GROUP BY category
            ORDER BY total_cents DESC, category ASC`,
        )
        .all(from, to) as CategoryTotalRow[];

      // Parsed, not cast: a category the enum no longer knows must fail here
      // rather than travel out through /api/summary as an unvalidated string.
      return rows.map((row) =>
        CategoryTotalSchema.parse({ category: row.category, totalCents: row.total_cents }),
      );
    },

    totalsByKindBetween(from, to) {
      return totalsByKind('WHERE occurred_on BETWEEN ? AND ?', from, to);
    },

    totalsByKindOverall() {
      // The balance is deliberately unbounded: it is every transaction ever
      // recorded, not the selected period (see CONTEXT.md, 余额 · Balance).
      return totalsByKind('');
    },

    periodTotalsBetween(from, to) {
      const rows = db
        .prepare(
          `SELECT substr(occurred_on, 1, 7) AS period, kind, SUM(amount_cents) AS total_cents
             FROM transactions
            WHERE occurred_on BETWEEN ? AND ?
            GROUP BY period, kind
            ORDER BY period ASC`,
        )
        .all(from, to) as PeriodKindTotalRow[];

      return rows.map((row) => ({
        period: row.period,
        kind: KindSchema.parse(row.kind),
        totalCents: row.total_cents,
      }));
    },
  };
}
