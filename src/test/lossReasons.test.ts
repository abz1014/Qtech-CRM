import { describe, it, expect } from 'vitest';
import { lossReasonLabel, lossReasonIcon, LOSS_REASONS } from '@/lib/lossReasons';

describe('lossReasonLabel', () => {
  it('maps a known reason to its label', () => {
    expect(lossReasonLabel('price_too_high')).toBe('Price too high');
    expect(lossReasonLabel('competitor_won')).toBe('Competitor won the deal');
  });

  it('returns "Not specified" for null/undefined', () => {
    expect(lossReasonLabel(null)).toBe('Not specified');
    expect(lossReasonLabel(undefined)).toBe('Not specified');
  });

  it('falls back to a humanized string for an unknown reason', () => {
    expect(lossReasonLabel('some_new_reason')).toBe('some new reason');
  });
});

describe('lossReasonIcon', () => {
  it('returns the icon for a known reason', () => {
    expect(lossReasonIcon('price_too_high')).toBe('💰');
  });
  it('returns a question mark for null', () => {
    expect(lossReasonIcon(null)).toBe('❓');
  });
});

describe('LOSS_REASONS', () => {
  it('every entry has a value, label, and icon', () => {
    expect(LOSS_REASONS.length).toBeGreaterThan(0);
    LOSS_REASONS.forEach(r => {
      expect(r.value).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.icon).toBeTruthy();
    });
  });
});
