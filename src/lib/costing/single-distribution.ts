import { calcSingleItem, type SingleItemInput, type CostingConfig } from './qtech-costing';

/**
 * PKR distribution of a single-item quote's incl-GST revenue.
 *
 * The five buckets sum to exactly `calcSingleItem(...).totalRevenue`.
 * (goods + charges + wht = company cost; + margin = ex-GST selling; + gst = revenue.)
 */
export interface SingleDistribution {
  goods: number;   // supplier goods landed in PKR (loaded price + packing) × qty
  charges: number; // freight + insurance + fixed charges (whole shipment)
  wht: number;     // withholding tax
  margin: number;  // our gross profit (excl GST)
  gst: number;     // pass-through GST
}

export function singleDistribution(input: SingleItemInput, cfg: CostingConfig): SingleDistribution {
  const r = calcSingleItem(input, cfg);
  const qty = Math.max(0, input.quantity || 0);
  return {
    goods: r.pricePkr * qty,
    charges: r.totalCharges,
    wht: r.whtAmount * qty,
    margin: r.grossProfit,
    gst: r.gstAmount * qty,
  };
}

export const SINGLE_DIST_META: { key: keyof SingleDistribution; label: string; color: string }[] = [
  { key: 'goods',   label: 'Supplier goods',     color: 'bg-primary' },
  { key: 'charges', label: 'Freight & charges',  color: 'bg-cyan-500' },
  { key: 'wht',     label: 'WHT',                color: 'bg-orange-500' },
  { key: 'margin',  label: 'Our margin',         color: 'bg-success' },
  { key: 'gst',     label: 'GST (pass-through)', color: 'bg-muted-foreground' },
];
