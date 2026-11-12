import { describe, expect, it } from 'vitest';

import {
  BalanceSchema,
  CATEGORIES,
  ExpenseInputSchema,
  IncomeInputSchema,
  SummarySchema,
  TransactionInputSchema,
  TransactionSchema,
  TrendSchema,
} from './schemas.js';

const base = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  amountCents: 1250,
  occurredOn: '2026-10-03',
  note: null,
  recordedAt: '2026-10-03T12:00:00.000Z',
};

const validExpense = { ...base, kind: 'expense', category: '餐饮' };
const validIncome = { ...base, kind: 'income', category: null };

/** A category that is *not* in the enum, used as the "outside" probe. */
const NOT_A_CATEGORY = '数码';

describe('TransactionSchema', () => {
  it('accepts a well-formed expense', () => {
    expect(TransactionSchema.parse(validExpense)).toEqual(validExpense);
  });

  it('accepts a well-formed income', () => {
    expect(TransactionSchema.parse(validIncome)).toEqual(validIncome);
  });

  // The whole point of modelling money as integer cents: a float must not
  // survive the HTTP boundary. This is the assertion behind the money rule.
  it('rejects a float amount', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, amountCents: 12.5 })).toThrow();
  });

  it('rejects a payload that sends `amount` instead of `amountCents`', () => {
    const { amountCents, ...withoutCents } = validExpense;
    expect(amountCents).toBe(1250); // the field we are deliberately dropping
    expect(() => TransactionSchema.parse({ ...withoutCents, amount: 12.5 })).toThrow();
  });

  // Strict objects: an unknown field is an error, never silently stripped.
  // Without this, a misspelled field name would be dropped in silence.
  it('rejects unknown fields instead of dropping them', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, amount: 12.5 })).toThrow();
    expect(() => TransactionSchema.parse({ ...validExpense, amountCentsTypo: 1250 })).toThrow();
  });

  // Direction lives in `kind`, so the amount itself never carries a sign.
  // Both of these would be valid if we had modelled direction as a sign.
  it('rejects a negative or zero amount', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, amountCents: -1 })).toThrow();
    expect(() => TransactionSchema.parse({ ...validExpense, amountCents: 0 })).toThrow();
  });

  it('rejects a kind outside the closed enum', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, kind: 'transfer' })).toThrow();
  });

  it('rejects a category outside the closed enum', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, category: NOT_A_CATEGORY })).toThrow();
  });

  it('accepts every category in the enum', () => {
    for (const category of CATEGORIES) {
      expect(TransactionSchema.parse({ ...validExpense, category }).category).toBe(category);
    }
  });

  // The kind <-> category invariant, both directions. An expense without a
  // category would be unfilterable; an income with one would be uncategorizable.
  it('rejects an expense with no category', () => {
    expect(() => TransactionSchema.parse({ ...validExpense, category: null })).toThrow();
    const { category, ...withoutCategory } = validExpense;
    expect(category).toBe('餐饮');
    expect(() => TransactionSchema.parse(withoutCategory)).toThrow();
  });

  it('rejects an income that carries a category', () => {
    expect(() => TransactionSchema.parse({ ...validIncome, category: '餐饮' })).toThrow();
  });

  it('rejects an income that omits the category field entirely', () => {
    const { category, ...withoutCategory } = validIncome;
    expect(category).toBeNull();
    expect(() => TransactionSchema.parse(withoutCategory)).toThrow();
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() =>
      TransactionSchema.parse({ ...validExpense, occurredOn: '2026-10-03T00:00:00Z' }),
    ).toThrow();
    expect(() => TransactionSchema.parse({ ...validExpense, occurredOn: '2026-02-30' })).toThrow();
  });
});

describe('TransactionInputSchema', () => {
  it('accepts an expense without id or recordedAt', () => {
    const input = { kind: 'expense', amountCents: 999, category: '交通', occurredOn: '2026-10-01' };
    expect(TransactionInputSchema.parse(input)).toEqual({ ...input, note: undefined });
  });

  // On the way in there is nothing to send for an income, so the client omits
  // the key rather than having to spell out `category: null`.
  it('accepts an income that omits the category key', () => {
    const input = { kind: 'income', amountCents: 850_000, occurredOn: '2026-10-01' };
    expect(TransactionInputSchema.parse(input)).toEqual({ ...input, note: undefined });
  });

  it('rejects an input with no kind', () => {
    expect(() =>
      TransactionInputSchema.parse({ amountCents: 999, category: '交通', occurredOn: '2026-10-01' }),
    ).toThrow();
  });

  // `kind` is present in both fixtures on purpose. Without it these would
  // still throw — but for the missing discriminator, not the float, and the
  // assertion would be green for the wrong reason.
  it('rejects a float amount', () => {
    expect(() =>
      ExpenseInputSchema.parse({
        kind: 'expense',
        amountCents: 9.99,
        category: '交通',
        occurredOn: '2026-10-01',
      }),
    ).toThrow();
    expect(() =>
      IncomeInputSchema.parse({ kind: 'income', amountCents: 9.99, occurredOn: '2026-10-01' }),
    ).toThrow();
  });

  it('rejects a zero or negative amount on an income too', () => {
    const income = { kind: 'income', occurredOn: '2026-10-01' };
    expect(() => IncomeInputSchema.parse({ ...income, amountCents: 0 })).toThrow();
    expect(() => IncomeInputSchema.parse({ ...income, amountCents: -100 })).toThrow();
  });
});

describe('SummarySchema', () => {
  const summary = {
    period: '2026-10',
    expenseCents: 2250,
    incomeCents: 850_000,
    netCents: 847_750,
    byCategory: [
      { category: '餐饮', totalCents: 1250 },
      { category: '交通', totalCents: 1000 },
    ],
  };

  it('accepts a well-formed summary', () => {
    expect(SummarySchema.parse(summary)).toEqual(summary);
  });

  // Net is the one money field allowed to go negative: a month can cost more
  // than it earned. `CentsSchema` would have rejected this.
  it('accepts a negative net', () => {
    expect(SummarySchema.parse({ ...summary, netCents: -1250 }).netCents).toBe(-1250);
  });

  it('still rejects a negative expense or income total', () => {
    expect(() => SummarySchema.parse({ ...summary, expenseCents: -1 })).toThrow();
    expect(() => SummarySchema.parse({ ...summary, incomeCents: -1 })).toThrow();
  });

  it('rejects a float total', () => {
    expect(() => SummarySchema.parse({ ...summary, expenseCents: 2250.5 })).toThrow();
  });

  it('rejects a malformed period', () => {
    expect(() => SummarySchema.parse({ ...summary, period: '2026-10-03' })).toThrow();
  });
});

describe('BalanceSchema', () => {
  const balance = { incomeCents: 850_000, expenseCents: 324_000, netCents: 526_000 };

  it('accepts a well-formed balance', () => {
    expect(BalanceSchema.parse(balance)).toEqual(balance);
  });

  // The cumulative balance is the most likely money value in the system to be
  // negative, so this is the field that most needs to allow it.
  it('accepts a negative net', () => {
    expect(BalanceSchema.parse({ ...balance, netCents: -100 }).netCents).toBe(-100);
  });

  it('rejects negative income or expense totals', () => {
    expect(() => BalanceSchema.parse({ ...balance, incomeCents: -1 })).toThrow();
    expect(() => BalanceSchema.parse({ ...balance, expenseCents: -1 })).toThrow();
  });
});

describe('TrendSchema', () => {
  const trend = {
    periods: [
      { period: '2026-08', expenseCents: 0, incomeCents: 0 },
      { period: '2026-09', expenseCents: 999, incomeCents: 0 },
    ],
  };

  it('accepts a well-formed trend', () => {
    expect(TrendSchema.parse(trend)).toEqual(trend);
  });

  it('accepts an empty window', () => {
    expect(TrendSchema.parse({ periods: [] })).toEqual({ periods: [] });
  });

  it('rejects a malformed period inside the window', () => {
    expect(() =>
      TrendSchema.parse({ periods: [{ period: '2026-9', expenseCents: 0, incomeCents: 0 }] }),
    ).toThrow();
  });

  it('rejects a negative month total', () => {
    expect(() =>
      TrendSchema.parse({ periods: [{ period: '2026-09', expenseCents: -1, incomeCents: 0 }] }),
    ).toThrow();
  });
});
