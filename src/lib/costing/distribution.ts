import { calcLine, type CostLineInput } from './qtech-costing';

/**
 * PKR distribution of the customer's incl-GST price.
 *
 * Every bucket is in PKR and, by construction, the seven buckets sum to
 * exactly `calcRfq(inputs).totalInclGst` — the total the customer pays.
 * This is the data behind the "Where the money goes" bar.
 */
export interface Distribution {
  goods: number;   // supplier goods (unitPrice * qty * exchange)
  packing: number;
  freight: number;
  duty: number;    // customs duty portion (netTotalBuy - CF in PKR)
  wht: number;     // withholding tax portion (totalWht - netTotalBuy)
  margin: number;  // our gross profit (excl GST)
  gst: number;     // pass-through GST (totalInclGst - totalQuoted)
}

export function distribution(inputs: CostLineInput[]): Distribution {
  const buckets: Distribution = { goods: 0, packing: 0, freight: 0, duty: 0, wht: 0, margin: 0, gst: 0 };
  for (const inp of inputs) {
    const r = calcLine(inp);
    const exch = r.exchangeRate;
    const cfPkr = r.totalCf * exch;
    buckets.goods += r.totalPrice * exch;
    buckets.packing += r.totalPacking * exch;
    buckets.freight += r.totalFreight * exch;
    buckets.duty += r.netTotalBuy - cfPkr;
    buckets.wht += r.totalWht - r.netTotalBuy;
    buckets.margin += r.totalProfit;
    buckets.gst += r.totalInclGst - r.totalQuoted;
  }
  return buckets;
}

export const DIST_META: { key: keyof Distribution; label: string; color: string }[] = [
  { key: 'goods',   label: 'Supplier goods', color: 'bg-primary' },
  { key: 'packing', label: 'Packing',        color: 'bg-info' },
  { key: 'freight', label: 'Freight',        color: 'bg-cyan-500' },
  { key: 'duty',    label: 'Customs duty',   color: 'bg-amber-500' },
  { key: 'wht',     label: 'WHT',            color: 'bg-orange-500' },
  { key: 'margin',  label: 'Our margin',     color: 'bg-success' },
  { key: 'gst',     label: 'GST (pass-through)', color: 'bg-muted-foreground' },
];
