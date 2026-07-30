import type { RFQLineItem, SupplierQuote } from '@/types/crm';

/** Per-line-item supplier assignment made while converting an RFQ to an order. */
export interface ItemVendorAssignment {
  quote_id: string;
  vendor_id: string;
  unit_cost: string;
}

/**
 * Total supplier cost across all line items, given each item's assigned
 * unit cost. Was previously computed inline in four separate places
 * (the total-cost row, the margin amount, the margin percentage, and the
 * order-creation payload) and had already started to read subtly
 * differently in each spot.
 */
export function calculateLineItemsCost(
  lineItems: RFQLineItem[],
  itemVendors: Record<string, ItemVendorAssignment | undefined>
): number {
  return lineItems.reduce((sum, li) => sum + Number(itemVendors[li.id]?.unit_cost || 0) * li.quantity, 0);
}

/** Margin between the customer-approved order value and the total supplier cost. */
export function calculateMargin(orderValue: number, totalCost: number): { amount: number; percent: number } {
  const amount = orderValue - totalCost;
  const percent = orderValue > 0 ? (amount / orderValue) * 100 : 0;
  return { amount, percent };
}

export interface OrderConversionInputs {
  lineItems: RFQLineItem[];
  itemVendors: Record<string, ItemVendorAssignment | undefined>;
  quotes: SupplierQuote[];
  getVendorName: (vendorId: string) => string;
  formatMoney: (amount: number) => string;
  additionalNotes: string;
}

export interface OrderConversionDerived {
  productLabel: string;
  totalCost: number;
  primaryVendorId: string;
  notes: string;
}

/**
 * Derives the fields that don't come directly from the convert-order form:
 * a product summary label, the total supplier cost, the primary vendor
 * (the one covering the most line items, falling back to the first quote's
 * vendor), and a supplier-breakdown notes block.
 */
export function buildOrderConversionFields(inputs: OrderConversionInputs): OrderConversionDerived {
  const { lineItems, itemVendors, quotes, getVendorName, formatMoney, additionalNotes } = inputs;

  const assignedItems = lineItems.filter(li => itemVendors[li.id]?.vendor_id);

  const productLabel = assignedItems.map(li => `${li.product_type} ×${li.quantity}`).join(', ');

  const totalCost = calculateLineItemsCost(lineItems, itemVendors);

  const vendorCounts: Record<string, number> = {};
  lineItems.forEach(li => {
    const v = itemVendors[li.id]?.vendor_id;
    if (v) vendorCounts[v] = (vendorCounts[v] || 0) + 1;
  });
  const primaryVendorId = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    || quotes[0]?.vendor_id || '';

  const breakdown = assignedItems
    .map(li => `• ${li.product_type} ×${li.quantity} — ${getVendorName(itemVendors[li.id]!.vendor_id)} @ ${formatMoney(Number(itemVendors[li.id]!.unit_cost || 0))}/unit`)
    .join('\n');
  const notes = `Supplier breakdown:\n${breakdown}${additionalNotes ? '\n\n' + additionalNotes : ''}`;

  return { productLabel, totalCost, primaryVendorId, notes };
}

/** A quote's value score plus whether it's the best-value and/or cheapest quote in the set. */
export interface RankedQuote {
  id: string;
  score: number;
  isBestValue: boolean;
  isCheapest: boolean;
}

/**
 * Ranks quotes by value score (price/lead-time/MOQ) and flags the cheapest
 * by unit price. "Best value" is only meaningful when there's more than one
 * quote to compare.
 */
export function rankSupplierQuotes(
  quotes: SupplierQuote[],
  scoreFn: (unitPrice: number, leadTimeDays: number, moq: number) => number
): { ranked: RankedQuote[]; bestValueId: string | null; cheapestId: string | null } {
  if (quotes.length === 0) return { ranked: [], bestValueId: null, cheapestId: null };

  const scores = quotes.map(q => ({ id: q.id, score: scoreFn(q.unit_price, q.lead_time_days, q.moq) }));
  const bestScore = Math.max(...scores.map(s => s.score));
  const bestValueId = quotes.length > 1 ? (scores.find(s => s.score === bestScore)?.id ?? null) : null;

  const cheapest = quotes.reduce((min, q) => q.unit_price < min.unit_price ? q : min);
  const cheapestId = cheapest.id;

  const ranked = scores.map(s => ({
    ...s,
    isBestValue: s.id === bestValueId,
    isCheapest: s.id === cheapestId,
  }));

  return { ranked, bestValueId, cheapestId };
}
