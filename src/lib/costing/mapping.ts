import type { CostLine } from '@/types/crm';
import type { CostLineInput } from './qtech-costing';

/** DB row (snake_case) → engine input (camelCase). Inputs only. */
export function costLineToInput(l: CostLine): CostLineInput {
  return {
    sr: l.sr, item: l.item, pn: l.pn, brand: l.brand, supplier: l.supplier,
    region: l.region, currency: l.currency,
    qty: l.qty,
    unitWeight: l.unit_weight,
    unitPrice: l.unit_price,
    unitPacking: l.unit_packing,
    unitFreight: l.unit_freight,
    exchangeRate: l.exchange_rate,
    dutyPct: l.duty_pct,
    whtPct: l.wht_pct,
    marginPct: l.margin_pct,
    gstPct: l.gst_pct,
  };
}
