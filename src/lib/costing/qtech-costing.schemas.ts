/**
 * Optional zod schemas for validating RFQ line input at the CRM boundary
 * (forms, API payloads, Supabase rows). Requires zod (already in the CRM).
 */
import { z } from 'zod';

const pct = z.number().min(0).max(1000).optional();
const money = z.number().min(0);

export const costLineSchema = z.object({
  sr: z.string().optional(),
  item: z.string().optional(),
  pn: z.string().optional(),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  region: z.string().optional(),
  currency: z.string().optional(),

  qty: z.number().min(0),
  unitWeight: z.number().min(0).optional(),
  unitPrice: money,
  unitPacking: z.number().min(0).optional(),
  unitFreight: z.number().min(0).optional(),
  exchangeRate: z.number().min(0).optional(),
  dutyPct: pct,
  whtPct: pct,
  marginPct: pct,
  gstPct: pct,
});

export const rfqSchema = z.object({
  rfqNo: z.string().optional(),
  customer: z.string().optional(),
  date: z.string().optional(),
  lines: z.array(costLineSchema).min(1),
});

export type CostLineParsed = z.infer<typeof costLineSchema>;
export type RfqParsed = z.infer<typeof rfqSchema>;
