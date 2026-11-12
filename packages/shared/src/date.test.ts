import { describe, expect, it } from 'vitest';

import { assertIsoDate, formatDayTime, isIsoDate, periodBounds, periodOf, recentPeriods, shiftPeriod, toIsoDate } from './date.js';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-10-03')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed strings', () => {
    expect(isIsoDate('2026-1-3')).toBe(false);
    expect(isIsoDate('26-10-03')).toBe(false);
    expect(isIsoDate('2026/10/03')).toBe(false);
    expect(isIsoDate('2026-10-03T00:00:00Z')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('rejects dates that do not exist', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2025-02-29')).toBe(false); // not a leap year
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
  });
});

describe('assertIsoDate', () => {
  it('passes through valid dates', () => {
    expect(() => assertIsoDate('2026-10-03')).not.toThrow();
  });

  it('throws on invalid dates', () => {
    expect(() => assertIsoDate('2026-02-30')).toThrow(RangeError);
  });
});

describe('toIsoDate', () => {
  it('formats a Date as its local calendar date', () => {
    expect(toIsoDate(new Date(2026, 9, 3, 23, 30))).toBe('2026-10-03');
    expect(toIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('rejects an invalid Date', () => {
    expect(() => toIsoDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('periodOf', () => {
  it('returns the natural month', () => {
    expect(periodOf('2026-10-03')).toBe('2026-10');
    expect(periodOf('2026-10-31')).toBe('2026-10');
  });

  it('throws on an invalid date', () => {
    expect(() => periodOf('2026-13-01')).toThrow(RangeError);
  });
});

describe('periodBounds', () => {
  it('spans the whole month', () => {
    expect(periodBounds('2026-10-03')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('handles February in a leap year', () => {
    expect(periodBounds('2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('handles February in a common year', () => {
    expect(periodBounds('2025-02-10')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
  });

  it('handles December without rolling into the next year', () => {
    expect(periodBounds('2026-12-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('shiftPeriod', () => {
  it('moves forward and backward within a year', () => {
    expect(shiftPeriod('2026-10', 1)).toBe('2026-11');
    expect(shiftPeriod('2026-10', -2)).toBe('2026-08');
  });

  it('rolls across year boundaries in both directions', () => {
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-01', -14)).toBe('2024-11');
  });

  it('returns the period itself for a zero shift', () => {
    expect(shiftPeriod('2026-10', 0)).toBe('2026-10');
  });

  it('throws on a malformed period', () => {
    expect(() => shiftPeriod('2026-13', 1)).toThrow(RangeError);
    expect(() => shiftPeriod('2026-10-03', 1)).toThrow(RangeError);
    expect(() => shiftPeriod('2026-1', 1)).toThrow(RangeError);
  });
});

describe('recentPeriods', () => {
  it('ends at the given period, oldest first', () => {
    expect(recentPeriods('2026-10', 3)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('crosses a year boundary', () => {
    expect(recentPeriods('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('returns a single period for a count of one', () => {
    expect(recentPeriods('2026-10', 1)).toEqual(['2026-10']);
  });

  it('returns an empty window for a count of zero', () => {
    expect(recentPeriods('2026-10', 0)).toEqual([]);
  });

  it('validates the end period even when the window is empty', () => {
    expect(() => recentPeriods('2026-13', 0)).toThrow(RangeError);
  });

  it('rejects a negative or fractional count', () => {
    expect(() => recentPeriods('2026-10', -1)).toThrow(RangeError);
    expect(() => recentPeriods('2026-10', 1.5)).toThrow(RangeError);
  });
});

describe('formatDayTime', () => {
  // Built from local Date parts and converted to ISO, so the assertion holds
  // in any timezone rather than only where the suite happens to run.
  const clock = (h: number, min: number): string => new Date(2026, 9, 7, h, min).toISOString();

  const now = new Date(2026, 9, 7, 20, 0); // 2026-10-07, local evening

  it('labels the current day as 今天', () => {
    expect(formatDayTime('2026-10-07', clock(12, 30), now)).toBe('今天 12:30');
  });

  it('labels the day before as 昨天', () => {
    expect(formatDayTime('2026-10-06', clock(18, 0), now)).toBe('昨天 18:00');
  });

  it('falls back to a month-day stamp for anything older', () => {
    expect(formatDayTime('2026-10-03', clock(9, 5), now)).toBe('10-03 09:05');
  });

  // The reason the day and the clock come from different fields: a lunch
  // recorded today but spent last week must not claim to be 今天, because the
  // list sorts it in with last week's rows.
  it('takes the day from the occurrence, not from when it was recorded', () => {
    expect(formatDayTime('2026-10-01', clock(12, 30), now)).toBe('10-01 12:30');
  });

  it('takes the clock from the recording time', () => {
    const morning = new Date(2026, 9, 7, 7, 45).toISOString();
    expect(formatDayTime('2026-10-07', morning, now)).toBe('今天 07:45');
  });

  // "Yesterday" is calendar arithmetic, not "24 hours ago" — these two are
  // the cases a naive difference-in-milliseconds calculation gets wrong.
  it('rolls back across a month boundary', () => {
    const firstOfMonth = new Date(2026, 10, 1, 8, 0); // 2026-11-01
    const lateLastMonth = new Date(2026, 9, 31, 22, 15).toISOString();
    expect(formatDayTime('2026-10-31', lateLastMonth, firstOfMonth)).toBe('昨天 22:15');
  });

  it('rolls back across a year boundary', () => {
    const newYear = new Date(2027, 0, 1, 8, 0); // 2027-01-01
    const newYearsEve = new Date(2026, 11, 31, 23, 59).toISOString();
    expect(formatDayTime('2026-12-31', newYearsEve, newYear)).toBe('昨天 23:59');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatDayTime('2026-10-07', clock(8, 5), now)).toBe('今天 08:05');
  });

  it('rejects a value that is not a timestamp', () => {
    expect(() => formatDayTime('2026-10-07', 'not-a-timestamp', now)).toThrow(RangeError);
  });

  it('rejects an occurrence that is not a calendar date', () => {
    expect(() => formatDayTime('2026-02-30', clock(12, 0), now)).toThrow(RangeError);
  });
});
