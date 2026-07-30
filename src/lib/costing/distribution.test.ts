import { describe, it, expect } from 'vitest';
import { calcRfq, SAMPLE_RFQ } from './qtech-costing';
import { distribution, type Distribution } from './distribution';

const sum = (d: Distribution) => Object.values(d).reduce((s, v) => s + v, 0);

describe('costing distribution (Where the money goes)', () => {
  const dist = distribution(SAMPLE_RFQ);
  const totals = calcRfq(SAMPLE_RFQ);

  it('all seven buckets sum to the customer incl-GST price', () => {
    expect(sum(dist)).toBeCloseTo(totals.totalInclGst, 4);
  });

  it('the margin bucket equals the RFQ gross profit', () => {
    expect(dist.margin).toBeCloseTo(totals.grossProfit, 4);
  });

  it('the GST bucket equals the pass-through GST', () => {
    expect(dist.gst).toBeCloseTo(totals.gst, 4);
  });

  it('cost buckets (goods+packing+freight+duty+wht) equal company cost', () => {
    const cost = dist.goods + dist.packing + dist.freight + dist.duty + dist.wht;
    expect(cost).toBeCloseTo(totals.totalCost, 4);
  });

  it('cost + margin equals the quoted (excl-GST) price', () => {
    const quoted = dist.goods + dist.packing + dist.freight + dist.duty + dist.wht + dist.margin;
    expect(quoted).toBeCloseTo(totals.totalExclGst, 4);
  });

  it('no bucket is negative for a normal RFQ', () => {
    for (const [k, v] of Object.entries(dist)) {
      expect(v, `bucket ${k}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the verified Sapphire figures', () => {
    expect(totals.totalExclGst).toBeCloseTo(1468314.78, 1);
    expect(totals.totalInclGst).toBeCloseTo(1732611.45, 1);
  });
});
