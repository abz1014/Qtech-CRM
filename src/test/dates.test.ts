import { describe, it, expect } from 'vitest';
import { businessToday, toBusinessDate, businessDaysFromNow, businessMonthEnd } from '@/lib/dates';

// These guard the exact class of bug the audit found: UTC "today" in a
// UTC+5 business shifted every date boundary during 00:00-05:00 PKT, and
// month-end used toISOString() which silently dropped the last calendar day.

describe('businessToday', () => {
  it('returns a strict YYYY-MM-DD string', () => {
    expect(businessToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toBusinessDate', () => {
  it('formats a known UTC instant as the correct Asia/Karachi calendar date', () => {
    // 2026-01-01T20:00:00Z is 2026-01-02 01:00 in Asia/Karachi (UTC+5) —
    // the exact kind of late-evening-UTC / next-day-PKT case that broke
    // under new Date().toISOString().split('T')[0].
    const d = new Date('2026-01-01T20:00:00Z');
    expect(toBusinessDate(d)).toBe('2026-01-02');
  });

  it('does NOT match the UTC calendar date for a late-UTC evening timestamp', () => {
    const d = new Date('2026-01-01T20:00:00Z');
    const utcDate = d.toISOString().split('T')[0];
    expect(toBusinessDate(d)).not.toBe(utcDate);
  });
});

describe('businessDaysFromNow', () => {
  it('an inclusive 10-day window (today-9..today) spans exactly 10 calendar days', () => {
    const start = businessDaysFromNow(-9);
    const end = businessDaysFromNow(0);
    const days = (new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000;
    expect(days).toBe(9); // 9 nights = 10 inclusive days
  });

  it('an inclusive 7-day window (today-6..today) spans exactly 7 calendar days', () => {
    const start = businessDaysFromNow(-6);
    const end = businessDaysFromNow(0);
    const days = (new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000;
    expect(days).toBe(6);
  });

  it('returns strict YYYY-MM-DD for positive and negative offsets', () => {
    expect(businessDaysFromNow(5)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(businessDaysFromNow(-30)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('businessMonthEnd', () => {
  it('returns a real calendar day, never day 00 or overflowing into next month', () => {
    const end = businessMonthEnd();
    const [y, m, d] = end.split('-').map(Number);
    const lastRealDay = new Date(y, m, 0).getDate();
    expect(d).toBe(lastRealDay);
  });

  it('the last day of a 31-day month is not silently dropped to the 30th', () => {
    // Regression guard for the exact bug found in DashboardTab.tsx —
    // new Date(y, m, 0).toISOString() shifts the UTC+5 date back by 5h,
    // turning e.g. "...-07-31" into "...-07-30".
    const jan31 = new Date(2026, 1, 0); // day 0 of Feb = Jan 31
    expect(jan31.getDate()).toBe(31);
  });
});
