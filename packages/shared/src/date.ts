/**
 * Dates cross every boundary as ISO 8601 `YYYY-MM-DD` strings. `Date` objects
 * never leave the function that created them (see CLAUDE.md).
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The period shape, duplicated from `PeriodSchema` on purpose: `schemas.ts`
 * imports this module, so importing it back would make the two circular.
 */
const ISO_PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MS_PER_DAY = 86_400_000;

const MONTHS_PER_YEAR = 12;

/**
 * True when `value` is a real calendar date written as `YYYY-MM-DD`.
 *
 * Rejects both malformed strings (`"2026-1-3"`) and dates that do not exist
 * (`"2026-02-30"`).
 */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * @throws RangeError if `value` is not a real `YYYY-MM-DD` calendar date.
 */
export function assertIsoDate(value: string): void {
  if (!isIsoDate(value)) {
    throw new RangeError(`assertIsoDate: "${value}" is not a YYYY-MM-DD date`);
  }
}

/**
 * The **local** calendar date of `at`, as `YYYY-MM-DD`.
 *
 * Local, not UTC: "today" means the user's today.
 */
export function toIsoDate(at: Date): string {
  if (Number.isNaN(at.getTime())) {
    throw new RangeError('toIsoDate: received an invalid Date');
  }

  const year = String(at.getFullYear()).padStart(4, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The accounting period (a natural month) an ISO date belongs to: `"2026-10"`.
 *
 * @throws RangeError if `isoDate` is not a real `YYYY-MM-DD` date.
 */
export function periodOf(isoDate: string): string {
  assertIsoDate(isoDate);
  return isoDate.slice(0, 7);
}

/** The inclusive `[first, last]` ISO dates of the period containing `isoDate`. */
export function periodBounds(isoDate: string): { from: string; to: string } {
  const period = periodOf(isoDate);
  const from = `${period}-01`;
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(first.getTime() + 31 * MS_PER_DAY);

  // First day of the following month, minus one day.
  const nextMonth = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  const end = new Date(nextMonth.getTime() - MS_PER_DAY);

  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Move a period by whole months: `shiftPeriod('2026-10', -2)` is `'2026-08'`.
 *
 * Months are counted from an absolute month index so that negative shifts and
 * year rollover fall out of the arithmetic instead of needing a special case.
 *
 * @throws RangeError if `period` is not a `YYYY-MM` period.
 */
export function shiftPeriod(period: string, months: number): string {
  const match = ISO_PERIOD_PATTERN.exec(period);
  if (match === null) {
    throw new RangeError(`shiftPeriod: "${period}" is not a YYYY-MM period`);
  }

  const absolute = Number(match[1]) * MONTHS_PER_YEAR + (Number(match[2]) - 1) + months;
  const year = Math.floor(absolute / MONTHS_PER_YEAR);
  const month = (((absolute % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR) + 1;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/**
 * The `count` periods ending at `endPeriod`, **oldest first**.
 *
 * The trend chart draws left to right, so the array order is the drawing order.
 *
 * @throws RangeError if `endPeriod` is not a `YYYY-MM` period, or `count` < 0.
 */
export function recentPeriods(endPeriod: string, count: number): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`recentPeriods: expected a non-negative count, received ${count}`);
  }
  // Validates `endPeriod` even when the loop below would not run.
  shiftPeriod(endPeriod, 0);

  return Array.from({ length: count }, (_unused, index) =>
    shiftPeriod(endPeriod, index - (count - 1)),
  );
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A transaction's timestamp as the list shows it: `"今天 12:30"`,
 * `"昨天 18:00"`, or `"10-03 12:30"` once it is older than that.
 *
 * The two halves come from different fields on purpose:
 *
 * - The **day** is `occurredOn` — the day the money actually moved. The list is
 *   sorted by that date, so taking the day from anywhere else would label a
 *   backfilled expense "今天" while it sits among last week's rows.
 * - The **clock** is `recordedAt` — the only time-of-day the system records.
 *   (See CONTEXT.md, 记录时间 · RecordedAt.)
 *
 * `now` is a parameter rather than read from the clock so that "today" is
 * decided by the caller — and so this stays testable without faking timers.
 * The clock renders in **local** time, matching `toIsoDate`.
 *
 * @throws RangeError if either argument is unparseable.
 */
export function formatDayTime(occurredOn: string, recordedAt: string, now: Date): string {
  const at = new Date(recordedAt);
  if (Number.isNaN(at.getTime())) {
    throw new RangeError(`formatDayTime: "${recordedAt}" is not a timestamp`);
  }
  assertIsoDate(occurredOn);

  const time = `${padTwo(at.getHours())}:${padTwo(at.getMinutes())}`;

  if (occurredOn === toIsoDate(now)) {
    return `今天 ${time}`;
  }

  // Day arithmetic through the Date constructor, so month and year rollover
  // (and leap days) are handled by the platform rather than by hand.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (occurredOn === toIsoDate(yesterday)) {
    return `昨天 ${time}`;
  }

  return `${occurredOn.slice(5)} ${time}`;
}
