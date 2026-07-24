import { describe, it, expect } from 'vitest';
import { calcRfq, calcSingleItem, SAMPLE_RFQ, DEFAULT_CONFIG, type SingleItemInput } from './qtech-costing';
import { rfqToApply, singleToApply } from './apply';

describe('costing → apply mapping (fills order/quote value)', () => {
  it('multi-item apply mirrors the RFQ totals exactly', () => {
    const t = calcRfq(SAMPLE_RFQ);
    const a = rfqToApply(t);
    expect(a.totalInclGst).toBe(t.totalInclGst);   // → order_value / quoted_price
    expect(a.totalExclGst).toBe(t.totalExclGst);
    expect(a.gst).toBe(t.gst);                      // → order_gst_amount
    expect(a.totalCost).toBe(t.totalCost);          // → cost_value
    // internal consistency: excl + gst == incl
    expect(a.totalExclGst + a.gst).toBeCloseTo(a.totalInclGst, 6);
  });

  const SINGLE: SingleItemInput = {
    quantity: 10, weightEach: 2, supplierPrice: 500, packing: 20,
    loadingPct: 10, exchangeRate: 45, marginPct: 25, freightMode: 'Air',
  };

  it('single-item apply mirrors the single-item result', () => {
    const r = calcSingleItem(SINGLE, DEFAULT_CONFIG);
    const a = singleToApply(r, SINGLE.quantity);
    expect(a.totalInclGst).toBeCloseTo(r.totalRevenue, 6);
    expect(a.totalExclGst).toBeCloseTo(r.totalSelling, 6);
    expect(a.gst).toBeCloseTo(r.gstAmount * SINGLE.quantity, 6);
    expect(a.totalCost).toBeCloseTo(r.totalCost, 6);
    expect(a.totalExclGst + a.gst).toBeCloseTo(a.totalInclGst, 4);
  });

  it('applied cost never exceeds applied price (non-negative margin) for the samples', () => {
    const m = rfqToApply(calcRfq(SAMPLE_RFQ));
    expect(m.totalCost).toBeLessThanOrEqual(m.totalExclGst);
    const s = singleToApply(calcSingleItem(SINGLE, DEFAULT_CONFIG), SINGLE.quantity);
    expect(s.totalCost).toBeLessThanOrEqual(s.totalExclGst);
  });
});
