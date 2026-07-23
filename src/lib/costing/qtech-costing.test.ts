/**
 * Regression test — locks the engine to the real Sapphire RFQ numbers.
 * Run with the CRM's existing vitest:  npm run test
 */
import { describe, it, expect } from 'vitest';
import { calcLine, calcRfq, SAMPLE_RFQ } from './qtech-costing';

describe('QTech multi-item RFQ costing', () => {
  it('reproduces the Sapphire RFQ grand totals exactly', () => {
    const t = calcRfq(SAMPLE_RFQ);
    expect(t.totalExclGst).toBeCloseTo(1468314.7842, 2); // sheet AB22
    expect(t.totalInclGst).toBeCloseTo(1732611.4453, 2); // sheet AE22
  });

  it('line 1 (PKR, 25% margin) matches the sheet', () => {
    const r = calcLine(SAMPLE_RFQ[0]);
    expect(r.unitCf).toBeCloseTo(25001, 4);          // Q2
    expect(r.netUnitBuy).toBeCloseTo(25001, 2);      // U2
    expect(r.unitQuoted).toBeCloseTo(32813.8125, 2); // AA2
    expect(r.unitGst).toBeCloseTo(38720.2987, 2);    // AD2
    expect(r.totalInclGst).toBeCloseTo(154881.195, 2); // AE2
  });

  it('line 3 (RMB, exchange 45, 30% margin) matches the sheet', () => {
    const r = calcLine(SAMPLE_RFQ[1]);
    expect(r.netUnitBuy).toBeCloseTo(321177.5581, 2); // U4
    expect(r.totalInclGst).toBeCloseTo(1034641.3858, 2); // AE4
  });

  it('treats a blank/zero exchange rate as 1 (auditable, not zero)', () => {
    const r = calcLine({ qty: 1, unitPrice: 100, exchangeRate: 0 });
    expect(r.exchangeRate).toBe(1);
    expect(r.netUnitBuy).toBe(100);
  });

  it('handles zero-value fields without NaN', () => {
    const r = calcLine({ qty: 0, unitPrice: 0 });
    expect(Number.isFinite(r.totalInclGst)).toBe(true);
    expect(r.totalInclGst).toBe(0);
  });
});
