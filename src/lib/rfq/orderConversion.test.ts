import { describe, it, expect } from 'vitest';
import {
  calculateLineItemsCost, calculateMargin, buildOrderConversionFields, rankSupplierQuotes,
  type ItemVendorAssignment,
} from './orderConversion';
import type { RFQLineItem, SupplierQuote } from '@/types/crm';

const lineItem = (id: string, quantity: number): RFQLineItem => ({
  id, rfq_id: 'rfq-1', product_type: `Item ${id}`, quantity, specification: '', target_price: null,
});

const quote = (id: string, vendor_id: string, unit_price: number, lead_time_days = 10, moq = 1): SupplierQuote => ({
  id, rfq_id: 'rfq-1', vendor_id, inquiry_id: null, received_at: '', unit_price, currency: 'PKR',
  lead_time_days, moq, validity_days: 30, notes: '', is_selected: false,
});

describe('calculateLineItemsCost', () => {
  it('sums unit_cost * quantity across assigned items', () => {
    const items = [lineItem('a', 2), lineItem('b', 3)];
    const assignments: Record<string, ItemVendorAssignment> = {
      a: { quote_id: 'q1', vendor_id: 'v1', unit_cost: '100' },
      b: { quote_id: 'q2', vendor_id: 'v2', unit_cost: '50' },
    };
    expect(calculateLineItemsCost(items, assignments)).toBe(2 * 100 + 3 * 50);
  });

  it('treats unassigned items as zero cost', () => {
    const items = [lineItem('a', 2), lineItem('b', 3)];
    expect(calculateLineItemsCost(items, {})).toBe(0);
  });
});

describe('calculateMargin', () => {
  it('computes amount and percent', () => {
    const { amount, percent } = calculateMargin(1000, 700);
    expect(amount).toBe(300);
    expect(percent).toBeCloseTo(30, 5);
  });

  it('returns 0 percent when order value is 0 (no division by zero)', () => {
    expect(calculateMargin(0, 0).percent).toBe(0);
  });
});

describe('buildOrderConversionFields', () => {
  const getVendorName = (id: string) => (id === 'v1' ? 'Acme' : id === 'v2' ? 'Beta' : 'Unknown');
  const formatMoney = (n: number) => `Rs ${n}`;

  it('builds a product label and cost total only from assigned items', () => {
    const items = [lineItem('a', 2), lineItem('b', 3)];
    const assignments: Record<string, ItemVendorAssignment> = {
      a: { quote_id: 'q1', vendor_id: 'v1', unit_cost: '100' },
      // 'b' left unassigned
    };
    const result = buildOrderConversionFields({
      lineItems: items, itemVendors: assignments, quotes: [], getVendorName, formatMoney, additionalNotes: '',
    });
    expect(result.productLabel).toBe('Item a ×2');
    expect(result.totalCost).toBe(200);
    expect(result.notes).toContain('Item a ×2 — Acme @ Rs 100/unit');
    expect(result.notes).not.toContain('Item b');
  });

  it('picks the vendor covering the most line items as primary', () => {
    const items = [lineItem('a', 1), lineItem('b', 1), lineItem('c', 1)];
    const assignments: Record<string, ItemVendorAssignment> = {
      a: { quote_id: 'q1', vendor_id: 'v1', unit_cost: '10' },
      b: { quote_id: 'q2', vendor_id: 'v1', unit_cost: '10' },
      c: { quote_id: 'q3', vendor_id: 'v2', unit_cost: '10' },
    };
    const result = buildOrderConversionFields({
      lineItems: items, itemVendors: assignments, quotes: [], getVendorName, formatMoney, additionalNotes: '',
    });
    expect(result.primaryVendorId).toBe('v1');
  });

  it('falls back to the first quote vendor when nothing is assigned', () => {
    const result = buildOrderConversionFields({
      lineItems: [], itemVendors: {}, quotes: [quote('q1', 'v9', 500)], getVendorName, formatMoney, additionalNotes: '',
    });
    expect(result.primaryVendorId).toBe('v9');
  });

  it('appends additional notes after the supplier breakdown', () => {
    const result = buildOrderConversionFields({
      lineItems: [], itemVendors: {}, quotes: [], getVendorName, formatMoney, additionalNotes: 'Rush order',
    });
    expect(result.notes).toBe('Supplier breakdown:\n\n\nRush order');
  });
});

describe('rankSupplierQuotes', () => {
  const scoreFn = (unitPrice: number) => 1000 - unitPrice; // cheaper = higher score, for a simple deterministic test

  it('returns empty result for no quotes', () => {
    expect(rankSupplierQuotes([], scoreFn)).toEqual({ ranked: [], bestValueId: null, cheapestId: null });
  });

  it('does not flag a best-value winner with only one quote', () => {
    const quotes = [quote('q1', 'v1', 100)];
    const { bestValueId, cheapestId } = rankSupplierQuotes(quotes, scoreFn);
    expect(bestValueId).toBeNull();
    expect(cheapestId).toBe('q1');
  });

  it('flags the highest-scoring quote as best value among multiple', () => {
    const quotes = [quote('q1', 'v1', 500), quote('q2', 'v2', 100), quote('q3', 'v3', 300)];
    const { bestValueId, cheapestId } = rankSupplierQuotes(quotes, scoreFn);
    expect(bestValueId).toBe('q2'); // cheapest also scores highest under this scoreFn
    expect(cheapestId).toBe('q2');
  });

  it('cheapest and best-value can differ', () => {
    // q1 is cheapest by price but scores lowest under an inverted scoreFn
    const invertedScoreFn = (unitPrice: number) => unitPrice;
    const quotes = [quote('q1', 'v1', 100), quote('q2', 'v2', 500)];
    const { bestValueId, cheapestId } = rankSupplierQuotes(quotes, invertedScoreFn);
    expect(cheapestId).toBe('q1');
    expect(bestValueId).toBe('q2');
  });
});
