import type { CostLine, CostingConfigValues } from '@/types/crm';
import type { CostLineInput, SingleItemInput, CostingConfig } from './qtech-costing';

/** DB row (snake_case) → multi-item engine input (camelCase). Inputs only. */
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

/** DB row (single mode) → single-item engine input (camelCase). Inputs only. */
export function costLineToSingleInput(l: CostLine): SingleItemInput {
  return {
    quantity: l.qty,
    weightEach: l.unit_weight,
    supplierPrice: l.unit_price,
    packing: l.unit_packing,
    loadingPct: l.loading_pct ?? 0,
    exchangeRate: l.exchange_rate,
    marginPct: l.margin_pct,
    freightMode: l.freight_mode ?? 'Air',
    shipmentWeight: l.shipment_weight ?? 0,
  };
}

/** Flat config row (snake_case) → engine CostingConfig (grouped, camelCase). */
export function configValuesToEngine(v: CostingConfigValues): CostingConfig {
  return {
    freightRates: {
      airRate: v.air_rate, seaRate: v.sea_rate,
      courierRate: v.courier_rate, roadRate: v.road_rate,
    },
    charges: {
      documentation: v.documentation, bankCharges: v.bank_charges,
      clearing: v.clearing, localTransport: v.local_transport,
    },
    taxSettings: {
      gstPercent: v.gst_percent, whtPercent: v.wht_percent,
      insurancePercent: v.insurance_percent,
    },
  };
}

/** Engine defaults expressed as a flat config-values row (for seeding the UI). */
export const DEFAULT_CONFIG_VALUES: CostingConfigValues = {
  air_rate: 5000, sea_rate: 180000, courier_rate: 1200, road_rate: 500,
  documentation: 0, bank_charges: 0, clearing: 0, local_transport: 0,
  gst_percent: 18, wht_percent: 5, insurance_percent: 0,
};
