/**
 * QTech Costing Engine — portable TypeScript port of the desktop app logic.
 * Framework-agnostic, ZERO dependencies. Drop into the Vite/React/Supabase CRM.
 *
 * Two independent models (both verified against real QTech quotes):
 *
 *   1. calcLine / calcRfq   → MULTI-ITEM RFQ model (matches the "Sapphire" sheet).
 *                             Each line independent. This is the primary model.
 *
 *   2. calcSingleItem       → the desktop app's single-item screen (Loading % +
 *                             PKR freight-from-settings). Kept for parity; note it
 *                             deliberately differs from the multi-item chain.
 *
 * All money math is plain IEEE-754 float, identical to the Python engine, so the
 * numbers match the desktop app and the reference spreadsheet to the last decimal.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  MULTI-ITEM RFQ MODEL  (the Sapphire chain)
//
//  unitCf      = unitPrice + unitFreight + unitPacking          [supplier currency]
//  netUnitBuy  = unitCf * (1 + duty%) * exchangeRate            [PKR]
//  unitWht     = netUnitBuy * (1 + wht%)                        [PKR, company cost]
//  unitQuoted  = unitWht * (1 + margin%)                        [PKR, excl GST]
//  unitGst     = unitQuoted * (1 + gst%)                        [PKR, incl GST]
//  lineTotal   = unitGst * qty
// ─────────────────────────────────────────────────────────────────────────────

export interface CostLineInput {
  // Identification (optional — for display / export only)
  sr?: string;
  item?: string;
  pn?: string;
  brand?: string;
  supplier?: string;
  region?: string;   // e.g. "PAK", "CHINA", "DUBAI", "GERMANY"
  currency?: string; // e.g. "PKR", "RMB", "EUR", "USD"

  // Numeric inputs
  qty: number;
  unitWeight?: number;   // kg
  unitPrice: number;     // in supplier currency
  unitPacking?: number;  // in supplier currency (per unit)
  unitFreight?: number;  // in supplier currency (per unit)
  exchangeRate?: number; // PKR per 1 unit of `currency`. Blank/0 → 1 (no conversion)
  dutyPct?: number;      // custom duty %
  whtPct?: number;       // withholding tax %
  marginPct?: number;    // profit margin %
  gstPct?: number;       // GST %
}

export interface CostLineResult {
  exchangeRate: number; // effective rate actually used (blank/0 → 1)
  qty: number;
  unitWeight: number;
  totalWeight: number;
  unitPrice: number;
  totalPrice: number;
  unitPacking: number;
  totalPacking: number;
  unitFreight: number;
  totalFreight: number;
  unitCf: number;         // supplier currency
  totalCf: number;        // supplier currency
  netUnitBuy: number;     // PKR
  netTotalBuy: number;    // PKR
  unitWht: number;        // PKR (company cost per unit)
  totalWht: number;       // PKR
  unitQuoted: number;     // PKR, excl GST
  totalQuoted: number;    // PKR, excl GST
  unitGst: number;        // PKR, incl GST (per unit final price)
  totalInclGst: number;   // PKR, incl GST (line total)
  unitProfit: number;     // PKR, excl GST
  totalProfit: number;    // PKR, excl GST
}

const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const f = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(f) ? f : 0;
};

/** Compute a single RFQ line. Pure function — mirrors the Sapphire sheet exactly. */
export function calcLine(input: CostLineInput): CostLineResult {
  const qty = num(input.qty);
  const price = num(input.unitPrice);
  const packing = num(input.unitPacking);
  const freight = num(input.unitFreight);
  const weight = num(input.unitWeight);
  const duty = num(input.dutyPct) / 100;
  const exch = num(input.exchangeRate) || 1; // blank/0 → 1 (PKR / no conversion)
  const wht = num(input.whtPct) / 100;
  const margin = num(input.marginPct) / 100;
  const gst = num(input.gstPct) / 100;

  const unitCf = price + freight + packing;
  const netUnitBuy = unitCf * (1 + duty) * exch;
  const unitWht = netUnitBuy * (1 + wht);
  const unitQuoted = unitWht * (1 + margin);
  const unitGst = unitQuoted * (1 + gst);
  const unitProfit = unitQuoted - unitWht;

  return {
    exchangeRate: exch,
    qty,
    unitWeight: weight,
    totalWeight: weight * qty,
    unitPrice: price,
    totalPrice: price * qty,
    unitPacking: packing,
    totalPacking: packing * qty,
    unitFreight: freight,
    totalFreight: freight * qty,
    unitCf,
    totalCf: unitCf * qty,
    netUnitBuy,
    netTotalBuy: netUnitBuy * qty,
    unitWht,
    totalWht: unitWht * qty,
    unitQuoted,
    totalQuoted: unitQuoted * qty,
    unitGst,
    totalInclGst: unitGst * qty,
    unitProfit,
    totalProfit: unitProfit * qty,
  };
}

export interface RfqTotals {
  lines: CostLineResult[];
  totalExclGst: number;   // sum of totalQuoted
  gst: number;            // totalInclGst - totalExclGst
  totalInclGst: number;   // grand total the customer pays
  totalCost: number;      // sum of totalWht (company cost incl WHT)
  grossProfit: number;    // totalExclGst - totalCost
}

/** Cost an entire RFQ (list of lines) and roll up the totals. */
export function calcRfq(lines: CostLineInput[]): RfqTotals {
  const results = lines.map(calcLine);
  const totalExclGst = results.reduce((s, r) => s + r.totalQuoted, 0);
  const totalInclGst = results.reduce((s, r) => s + r.totalInclGst, 0);
  const totalCost = results.reduce((s, r) => s + r.totalWht, 0);
  return {
    lines: results,
    totalExclGst,
    gst: totalInclGst - totalExclGst,
    totalInclGst,
    totalCost,
    grossProfit: totalExclGst - totalCost,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE-ITEM MODEL  (desktop "single RFQ" screen)
//
//  NOTE: this chain is intentionally DIFFERENT from the multi-item model above —
//  it uses a Loading % and pulls freight from configured PKR rates. Kept only for
//  parity with the desktop single-item screen. For real mixed RFQs use calcRfq.
// ─────────────────────────────────────────────────────────────────────────────

export type FreightMode = 'Air' | 'Sea' | 'Courier' | 'Road';

export interface CostingConfig {
  freightRates: { airRate: number; seaRate: number; courierRate: number; roadRate: number };
  charges: { documentation: number; bankCharges: number; clearing: number; localTransport: number };
  taxSettings: { gstPercent: number; whtPercent: number; insurancePercent: number };
}

export const DEFAULT_CONFIG: CostingConfig = {
  freightRates: { airRate: 5000, seaRate: 180000, courierRate: 1200, roadRate: 500 },
  charges: { documentation: 0, bankCharges: 0, clearing: 0, localTransport: 0 },
  taxSettings: { gstPercent: 18, whtPercent: 5, insurancePercent: 0 },
};

export interface SingleItemInput {
  quantity: number;
  weightEach?: number;
  supplierPrice: number;
  packing?: number;      // supplier currency, per unit
  loadingPct?: number;   // %
  exchangeRate: number;  // PKR per 1 unit of currency (0 → no conversion)
  marginPct?: number;    // %
  freightMode?: FreightMode;
  shipmentWeight?: number; // kg; if 0/blank → quantity * weightEach
}

export interface SingleItemResult {
  loadedPrice: number;
  cfPrice: number;
  pricePkr: number;
  freightCost: number;
  insurance: number;
  totalCharges: number;
  perUnitFreight: number;
  landedCost: number;
  whtAmount: number;
  companyCost: number;
  sellingPrice: number;   // excl GST
  gstAmount: number;
  finalUnitPrice: number; // incl GST
  totalRevenue: number;   // incl GST
  totalSelling: number;   // excl GST
  totalCost: number;
  grossProfit: number;
  marginActualPct: number;
}

export function calcSingleItem(input: SingleItemInput, cfg: CostingConfig = DEFAULT_CONFIG): SingleItemResult {
  const qty = num(input.quantity);
  const weightEach = num(input.weightEach);
  const supplierPrice = num(input.supplierPrice);
  const packing = num(input.packing);
  const loading = num(input.loadingPct) / 100;
  const margin = num(input.marginPct) / 100;
  const exch = num(input.exchangeRate);
  const shipmentWeight = num(input.shipmentWeight) || qty * weightEach;

  const gst = cfg.taxSettings.gstPercent / 100;
  const wht = cfg.taxSettings.whtPercent / 100;
  const insurancePct = cfg.taxSettings.insurancePercent / 100;

  const loadedPrice = supplierPrice * (1 + loading);
  const cfPrice = loadedPrice + packing;
  const pricePkr = exch !== 0 ? cfPrice * exch : cfPrice;

  let freightCost: number;
  switch (input.freightMode) {
    case 'Sea': freightCost = cfg.freightRates.seaRate; break;
    case 'Courier': freightCost = cfg.freightRates.courierRate; break;
    case 'Road': freightCost = cfg.freightRates.roadRate * shipmentWeight; break;
    default: freightCost = cfg.freightRates.airRate * shipmentWeight; // Air
  }

  const insurance = freightCost * insurancePct;
  const totalCharges =
    freightCost + insurance +
    cfg.charges.documentation + cfg.charges.bankCharges +
    cfg.charges.clearing + cfg.charges.localTransport;

  const perUnitFreight = qty > 0 ? totalCharges / qty : 0;
  const landedCost = pricePkr + perUnitFreight;
  const whtAmount = landedCost * wht;
  const companyCost = landedCost + whtAmount;
  const sellingPrice = companyCost * (1 + margin);
  const gstAmount = sellingPrice * gst;
  const finalUnitPrice = sellingPrice + gstAmount;

  const totalRevenue = qty > 0 ? finalUnitPrice * qty : 0;
  const totalSelling = qty > 0 ? sellingPrice * qty : 0;
  const totalCost = qty > 0 ? companyCost * qty : 0;
  const grossProfit = totalSelling - totalCost;
  const marginActualPct = totalSelling > 0 ? (grossProfit / totalSelling) * 100 : 0;

  return {
    loadedPrice, cfPrice, pricePkr, freightCost, insurance, totalCharges,
    perUnitFreight, landedCost, whtAmount, companyCost, sellingPrice,
    gstAmount, finalUnitPrice, totalRevenue, totalSelling, totalCost,
    grossProfit, marginActualPct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reference data — 7 real lines from the Sapphire RFQ.
//  calcRfq(SAMPLE_RFQ) must yield: totalExclGst ≈ 1,468,314.78, totalInclGst ≈ 1,732,611.45
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_RFQ: CostLineInput[] = [
  { sr: '1', item: 'ISOLATING SWITCHES', region: 'PAK', currency: 'PKR', qty: 4, unitWeight: 1, unitPrice: 24500, unitPacking: 500, unitFreight: 1, exchangeRate: 1, dutyPct: 0, whtPct: 5, marginPct: 25, gstPct: 18 },
  { sr: '3', item: 'CPU CARD', region: 'CHINA', currency: 'RMB', qty: 2, unitWeight: 1, unitPrice: 7020, unitPacking: 116.27906976744185, unitFreight: 1, exchangeRate: 45, dutyPct: 0, whtPct: 5, marginPct: 30, gstPct: 18 },
  { sr: '13', item: 'RECHARGEABLE BATTERY 12V 12AH', region: 'PAK', currency: 'PKR', qty: 3, unitWeight: 5, unitPrice: 7560, unitPacking: 1000, unitFreight: 1, exchangeRate: 1, dutyPct: 0, whtPct: 5, marginPct: 20, gstPct: 18 },
  { sr: '24', item: 'AIR PRESSURE SWITCH', region: 'CHINA', currency: 'RMB', qty: 4, unitWeight: 0.7, unitPrice: 495, unitPacking: 116.27906976744185, unitFreight: 1, exchangeRate: 45, dutyPct: 0, whtPct: 5, marginPct: 15, gstPct: 18 },
  { sr: '29', item: 'PRESSURE GUAGE', region: 'CHINA', currency: 'RMB', qty: 30, unitWeight: 0.4, unitPrice: 93.1, unitPacking: 46.51162790697674, unitFreight: 0.1, exchangeRate: 45, dutyPct: 0, whtPct: 5, marginPct: 25, gstPct: 18 },
  { sr: '30', item: 'IC', region: 'CHINA', currency: 'RMB', qty: 6, unitWeight: 0.2, unitPrice: 61.2, unitPacking: 31.007751937984494, unitFreight: 0.1, exchangeRate: 45, dutyPct: 0, whtPct: 5, marginPct: 30, gstPct: 18 },
  { sr: '31', item: 'FET', region: 'CHINA', currency: 'RMB', qty: 6, unitWeight: 0.1, unitPrice: 4.8, unitPacking: 31.007751937984494, unitFreight: 0.1, exchangeRate: 45, dutyPct: 0, whtPct: 5, marginPct: 30, gstPct: 18 },
];
