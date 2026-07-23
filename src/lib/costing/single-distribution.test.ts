import { describe, it, expect } from 'vitest';
import { calcSingleItem, DEFAULT_CONFIG, type SingleItemInput } from './qtech-costing';
import { singleDistribution } from './single-distribution';

const sum = (d: Record<string, number>) => Object.values(d).reduce((s, v) => s + v, 0);

// A representative single-item quote: 10 units, 2 kg each, RMB priced, air freight.
const SAMPLE: SingleItemInput = {
  quantity: 10, weightEach: 2, supplierPrice: 500, packing: 20,
  loadingPct: 10, exchangeRate: 45, marginPct: 25, freightMode: 'Air',
};

describe('single-item distribution', () => {
  const dist = singleDistribution(SAMPLE, DEFAULT_CONFIG);
  const r = calcSingleItem(SAMPLE, DEFAULT_CONFIG);

  it('all five buckets sum to total revenue (incl GST)', () => {
    expect(sum(dist)).toBeCloseTo(r.totalRevenue, 4);
  });

  it('the margin bucket equals gross profit', () => {
    expect(dist.margin).toBeCloseTo(r.grossProfit, 4);
  });

  it('the GST bucket equals gst × qty', () => {
    expect(dist.gst).toBeCloseTo(r.gstAmount * SAMPLE.quantity, 4);
  });

  it('goods + charges + wht equals company cost', () => {
    expect(dist.goods + dist.charges + dist.wht).toBeCloseTo(r.totalCost, 4);
  });

  it('goods + charges + wht + margin equals ex-GST selling total', () => {
    expect(dist.goods + dist.charges + dist.wht + dist.margin).toBeCloseTo(r.totalSelling, 4);
  });

  it('no bucket is negative for a normal quote', () => {
    for (const [k, v] of Object.entries(dist)) {
      expect(v, `bucket ${k}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('freight scales with shipping mode (Sea flat vs Air per-kg)', () => {
    const air = calcSingleItem({ ...SAMPLE, freightMode: 'Air' }, DEFAULT_CONFIG);
    const sea = calcSingleItem({ ...SAMPLE, freightMode: 'Sea' }, DEFAULT_CONFIG);
    // Air = 5000 × 20kg = 100,000; Sea = flat 180,000 → different landed cost
    expect(air.freightCost).toBeCloseTo(5000 * 20, 4);
    expect(sea.freightCost).toBeCloseTo(180000, 4);
    expect(sea.finalUnitPrice).not.toBeCloseTo(air.finalUnitPrice, 2);
  });
});
