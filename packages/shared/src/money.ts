/**
 * Money is always an integer number of cents.
 *
 * This module is the ONLY place in the repository where yuan <-> cents
 * conversion may happen (see CLAUDE.md). Everywhere else, a money value is
 * already in cents and is named `...Cents`.
 */

const CENTS_PER_YUAN = 100;

/**
 * Convert a yuan amount to whole cents.
 *
 * Uses rounding because binary floating point cannot represent most decimal
 * yuan amounts exactly: `19.99 * 100` is `1998.9999999999998` in IEEE 754.
 *
 * @throws RangeError if `yuan` is not a finite number.
 */
export function toCents(yuan: number): number {
  if (!Number.isFinite(yuan)) {
    throw new RangeError(`toCents: expected a finite number, received ${yuan}`);
  }
  return Math.round(yuan * CENTS_PER_YUAN);
}

/**
 * Convert whole cents back to a yuan amount.
 *
 * The result is a float and is safe only for display arithmetic — never store
 * or transmit it.
 *
 * @throws RangeError if `cents` is not an integer.
 */
export function toYuan(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`toYuan: expected integer cents, received ${cents}`);
  }
  return cents / CENTS_PER_YUAN;
}

/** Render cents as a fixed two-decimal yuan string, e.g. `1250` -> `"12.50"`. */
export function formatYuan(cents: number): string {
  return toYuan(cents).toFixed(2);
}

/**
 * The same two decimals, with thousands separators: `1268000` -> `"12,680.00"`.
 *
 * `en-US` rather than a Chinese locale on purpose: both group by three with a
 * comma and a dot for the decimal, but `en-US` is guaranteed present in every
 * ICU build, so the output cannot change with the host's locale data.
 */
export function formatYuanGrouped(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toYuan(cents));
}
