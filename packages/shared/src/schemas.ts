import { z } from 'zod';

import { isIsoDate } from './date.js';

/**
 * The direction of a transaction (see CONTEXT.md, 类型 · Kind).
 *
 * Direction is carried by this field and **never** by the sign of the amount:
 * `amountCents` is positive on both sides of the ledger. See
 * `docs/adr/0002-kind-carries-direction.md`.
 */
export const KINDS = ['expense', 'income'] as const;

export type Kind = (typeof KINDS)[number];

export const KindSchema = z.enum(KINDS);

/**
 * The closed set of categories a **expense** can belong to (see CONTEXT.md).
 * There is no user-defined category, and income carries no category at all.
 */
export const CATEGORIES = [
  '餐饮',
  '交通',
  '购物',
  '娱乐',
  '居住',
  '通讯',
  '医疗',
  '其他',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CategorySchema = z.enum(CATEGORIES);

/** The single category an income is allowed to have: none. */
export const NO_CATEGORY = null;

/**
 * A real calendar date, `YYYY-MM-DD`. Delegates to `isIsoDate` so the frontend,
 * the API and the tests all agree on what a valid date is.
 */
export const IsoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'Expected a real YYYY-MM-DD calendar date' });

/** An ISO 8601 timestamp, e.g. `new Date().toISOString()`. */
export const IsoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected an ISO 8601 timestamp',
  });

/** A natural-month accounting period, `YYYY-MM` (see CONTEXT.md). */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Expected a YYYY-MM period' });

/**
 * A transaction amount: a whole, **positive** number of cents. Never a float,
 * never negative — the direction lives in `kind`. This is the assertion behind
 * the "money is integer cents" rule.
 */
export const CentsSchema = z
  .number()
  .int({ message: 'Money must be whole cents, never a float' })
  .positive({ message: 'Amounts must be positive' });

/** An aggregate that cannot go below zero: a period's spending or earnings. */
export const NonNegativeCentsSchema = z.number().int().nonnegative();

/**
 * A **signed** money value. Balance and net totals are the only money in the
 * system that may be negative — you can spend more than you have earned —
 * which is why they cannot use `CentsSchema`.
 */
export const SignedCentsSchema = z.number().int();

/**
 * The fields every transaction has regardless of direction.
 *
 * `recordedAt` is when the row was written, not when the money moved; it is
 * shown in the list but never enters an aggregation (see CONTEXT.md,
 * 记录时间 · RecordedAt).
 */
const transactionBase = {
  id: z.uuid(),
  amountCents: CentsSchema,
  occurredOn: IsoDateSchema,
  note: z.string().max(200).nullable(),
  recordedAt: IsoTimestampSchema,
};

/**
 * A recorded expense: money out, always with exactly one category.
 */
export const ExpenseTransactionSchema = z.strictObject({
  ...transactionBase,
  kind: z.literal('expense'),
  category: CategorySchema,
});

/**
 * A recorded income: money in. `category` is present and `null` rather than
 * omitted, so a reader never has to ask whether the field was forgotten.
 */
export const IncomeTransactionSchema = z.strictObject({
  ...transactionBase,
  kind: z.literal('income'),
  category: z.literal(NO_CATEGORY),
});

/**
 * A single movement of money, as returned by the API.
 *
 * A discriminated union rather than one object with an optional `category`:
 * this way `transaction.kind === 'expense'` narrows `category` to a real
 * `Category` at compile time, so the UI cannot render a category on an income.
 *
 * Strict: an unknown field is a rejected payload, not a field to ignore. A
 * client that misspells `amountCents` must get a 400, never a silent drop.
 */
export const TransactionSchema = z.discriminatedUnion('kind', [
  ExpenseTransactionSchema,
  IncomeTransactionSchema,
]);

/**
 * What a client may send to record an expense. `id` and `recordedAt` are ours.
 *
 * Income carries no `category` key at all on the way in — there is nothing to
 * send — but it still comes back as an explicit `null` on the way out.
 */
export const ExpenseInputSchema = z.strictObject({
  kind: z.literal('expense'),
  amountCents: CentsSchema,
  category: CategorySchema,
  occurredOn: IsoDateSchema,
  note: z.string().max(200).nullish(),
});

export const IncomeInputSchema = z.strictObject({
  kind: z.literal('income'),
  amountCents: CentsSchema,
  occurredOn: IsoDateSchema,
  note: z.string().max(200).nullish(),
});

export const TransactionInputSchema = z.discriminatedUnion('kind', [
  ExpenseInputSchema,
  IncomeInputSchema,
]);

/** One row of a monthly summary: how much went to a single category. */
export const CategoryTotalSchema = z.strictObject({
  category: CategorySchema,
  totalCents: NonNegativeCentsSchema,
});

/**
 * A monthly rollup of transactions (see CONTEXT.md, 汇总 · Summary).
 *
 * `byCategory` covers expenses only, because income has no category.
 * `netCents` is signed.
 */
export const SummarySchema = z.strictObject({
  period: PeriodSchema,
  expenseCents: NonNegativeCentsSchema,
  incomeCents: NonNegativeCentsSchema,
  netCents: SignedCentsSchema,
  byCategory: z.array(CategoryTotalSchema),
});

/**
 * The running balance: every transaction ever recorded, not a period
 * (see CONTEXT.md, 余额 · Balance). `netCents` is signed.
 */
export const BalanceSchema = z.strictObject({
  incomeCents: NonNegativeCentsSchema,
  expenseCents: NonNegativeCentsSchema,
  netCents: SignedCentsSchema,
});

/** One month of the trend chart. */
export const PeriodTotalSchema = z.strictObject({
  period: PeriodSchema,
  expenseCents: NonNegativeCentsSchema,
  incomeCents: NonNegativeCentsSchema,
});

/**
 * Consecutive months ending at the requested period, **oldest first** — the
 * array order is the drawing order. Months with no transactions are present
 * with zeros rather than missing, so the chart never has a gap in it.
 */
export const TrendSchema = z.strictObject({
  periods: z.array(PeriodTotalSchema),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type ExpenseTransaction = z.infer<typeof ExpenseTransactionSchema>;
export type IncomeTransaction = z.infer<typeof IncomeTransactionSchema>;
export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;
export type IncomeInput = z.infer<typeof IncomeInputSchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type CategoryTotal = z.infer<typeof CategoryTotalSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type PeriodTotal = z.infer<typeof PeriodTotalSchema>;
export type Trend = z.infer<typeof TrendSchema>;
