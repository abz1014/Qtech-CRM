import { describe, it, expect } from 'vitest';
import { formatPKR, formatDate } from '@/lib/format';

describe('formatPKR', () => {
  it('formats with thousands grouping and no decimals', () => {
    const out = formatPKR(100000);
    expect(out).toContain('100,000');
    expect(out).not.toContain('.00');
  });

  it('handles zero', () => {
    expect(formatPKR(0)).toContain('0');
  });

  it('formats large industrial amounts', () => {
    expect(formatPKR(20000000)).toContain('20,000,000');
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string as DD Mon YYYY', () => {
    expect(formatDate('2026-07-07')).toBe('07 Jul 2026');
  });

  it('returns an em dash for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('returns an em dash for an unparseable date', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});
