-- ============================================================================
-- 2026-07-12 · PO Costing
-- Stores costing INPUTS only (never computed values) — the app recomputes with
-- the QTech engine on read, so a rate/rule change never leaves stale prices.
-- A costing attaches to EITHER an RFQ (quote-time) OR an order (incl. existing
-- orders with no RFQ). Exactly one parent per line.
-- Also adds orders.order_gst_amount so order value can be shown with/without GST.
-- Visible to admin + sales (they cost RFQs to quote); not engineers.
-- Safe to run repeatedly.
-- ============================================================================

-- ── Order GST split (so value shows with and without GST) ───────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_gst_amount NUMERIC;

-- ── Costing lines (engine inputs) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id   UUID REFERENCES rfqs(id)   ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- identification (display/export only)
  sr TEXT DEFAULT '', item TEXT DEFAULT '', pn TEXT DEFAULT '',
  brand TEXT DEFAULT '', supplier TEXT DEFAULT '',
  region TEXT DEFAULT '', currency TEXT DEFAULT 'PKR',

  -- numeric inputs (fed straight into the costing engine)
  qty NUMERIC NOT NULL DEFAULT 0,
  unit_weight   NUMERIC DEFAULT 0,
  unit_price    NUMERIC NOT NULL DEFAULT 0,
  unit_packing  NUMERIC DEFAULT 0,
  unit_freight  NUMERIC DEFAULT 0,
  exchange_rate NUMERIC DEFAULT 1,
  duty_pct   NUMERIC DEFAULT 0,
  wht_pct    NUMERIC DEFAULT 0,
  margin_pct NUMERIC DEFAULT 0,
  gst_pct    NUMERIC DEFAULT 0,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- exactly one parent
  CONSTRAINT cost_lines_one_parent CHECK (
    (rfq_id IS NOT NULL AND order_id IS NULL) OR
    (rfq_id IS NULL AND order_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cost_lines_rfq   ON cost_lines(rfq_id);
CREATE INDEX IF NOT EXISTS idx_cost_lines_order ON cost_lines(order_id);

-- ── RLS: admin + sales (read + write); engineers excluded ───────────────────
ALTER TABLE cost_lines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cost_lines' AND policyname = 'cost_lines_rw') THEN
    CREATE POLICY "cost_lines_rw" ON cost_lines FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')));
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cost_lines') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cost_lines;
  END IF;
END $$;
