import { describe, expect, it } from 'vitest';

import { formatYuan, formatYuanGrouped, toCents, toYuan } from './money.js';

describe('toCents', () => {
  it('converts whole yuan', () => {
    expect(toCents(12)).toBe(1200);
  });

  it('converts yuan with one or two decimals', () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(0.01)).toBe(1);
  });

  // These are the cases binary floating point gets wrong: `19.99 * 100` is
  // 1998.9999999999998 in IEEE 754, so a bare multiplication would truncate.
  it('rounds away binary floating point error', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(1.15)).toBe(115);
    expect(toCents(8.87)).toBe(887);
  });

  it('returns 0 for 0', () => {
    expect(toCents(0)).toBe(0);
  });

  it('rejects values that are not finite numbers', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('toYuan', () => {
  it('converts cents back to yuan', () => {
    expect(toYuan(1250)).toBe(12.5);
    expect(toYuan(1)).toBe(0.01);
  });

  it('rejects fractional cents', () => {
    expect(() => toYuan(12.5)).toThrow(RangeError);
  });
});

describe('formatYuan', () => {
  it('always shows two decimals', () => {
    expect(formatYuan(1250)).toBe('12.50');
    expect(formatYuan(1200)).toBe('12.00');
    expect(formatYuan(5)).toBe('0.05');
  });
});

describe('formatYuanGrouped', () => {
  it('groups thousands', () => {
    expect(formatYuanGrouped(1_268_000)).toBe('12,680.00');
    expect(formatYuanGrouped(850_000)).toBe('8,500.00');
  });

  it('leaves amounts under a thousand ungrouped', () => {
    expect(formatYuanGrouped(324_000)).toBe('3,240.00');
    expect(formatYuanGrouped(3800)).toBe('38.00');
    expect(formatYuanGrouped(5)).toBe('0.05');
  });

  it('groups millions too', () => {
    expect(formatYuanGrouped(123_456_789)).toBe('1,234,567.89');
  });

  // The balance may be negative, so the minus has to survive formatting.
  it('keeps the sign on a negative net', () => {
    expect(formatYuanGrouped(-1250)).toBe('-12.50');
  });

  it('renders zero as zero', () => {
    expect(formatYuanGrouped(0)).toBe('0.00');
  });
});

describe('round trip', () => {
  it('survives cents -> yuan -> cents', () => {
    for (const cents of [1, 29, 100, 887, 1999, 125_000]) {
      expect(toCents(toYuan(cents))).toBe(cents);
    }
  });
});
