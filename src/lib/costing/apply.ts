import type { RfqTotals, SingleItemResult } from './qtech-costing';

/**
 * The subset of costing totals used to fill an RFQ quote / order value.
 * Both the multi-item and single-item models produce this shape so a single
 * `onApply` handler works for either.
 */
export interface ApplyTotals {
  totalInclGst: number;  // customer price incl GST → order_value / quoted_price
  totalExclGst: number;  // quoted price excl GST
  gst: number;           // pass-through GST → order_gst_amount
  totalCost: number;     // company cost → cost_value
}

export const rfqToApply = (t: RfqTotals): ApplyTotals => ({
  totalInclGst: t.totalInclGst,
  totalExclGst: t.totalExclGst,
  gst: t.gst,
  totalCost: t.totalCost,
});

export const singleToApply = (r: SingleItemResult, qty: number): ApplyTotals => ({
  totalInclGst: r.totalRevenue,
  totalExclGst: r.totalSelling,
  gst: r.gstAmount * qty,
  totalCost: r.totalCost,
});
