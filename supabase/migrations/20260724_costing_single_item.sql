-- ============================================================================
-- 2026-07-24 · PO Costing — Single-item model + shared config
-- Adds the desktop "single item" costing model alongside the multi-item RFQ
-- model. Single-item derives freight from weight × shipping mode and pulls
-- fixed charges / tax from a shared, admin-managed config.
--
--   • cost_lines gains a `mode` ('multi' | 'single') and the single-item-only
--     inputs (loading %, freight mode, shipment weight). config_snapshot stores
--     the EFFECTIVE freight/charges config used for that single-item line, so a
--     saved quote never silently changes when an admin later edits global rates.
--   • costing_config is a singleton (id = 1) holding the default freight rates,
--     fixed charges and tax %. Admin writes; admin + sales read.
--
-- We still store INPUTS only (never computed money) — the app recomputes with
-- the QTech engine on read. Safe to run repeatedly.
-- ============================================================================

-- ── cost_lines: single-item columns ────────────────────────────────────────
ALTER TABLE cost_lines ADD COLUMN IF NOT EXISTS mode            TEXT NOT NULL DEFAULT 'multi';
ALTER TABLE cost_lines ADD COLUMN IF NOT EXISTS loading_pct     NUMERIC DEFAULT 0;
ALTER TABLE cost_lines ADD COLUMN IF NOT EXISTS freight_mode    TEXT DEFAULT 'Air';
ALTER TABLE cost_lines ADD COLUMN IF NOT EXISTS shipment_weight NUMERIC DEFAULT 0;
ALTER TABLE cost_lines ADD COLUMN IF NOT EXISTS config_snapshot JSONB;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_lines_mode_check') THEN
    ALTER TABLE cost_lines ADD CONSTRAINT cost_lines_mode_check CHECK (mode IN ('multi','single'));
  END IF;
END $$;

-- ── costing_config: singleton shared settings ───────────────────────────────
CREATE TABLE IF NOT EXISTS costing_config (
  id INTEGER PRIMARY KEY DEFAULT 1,

  -- per-kg freight rates (PKR) — Sea is a flat shipment rate
  air_rate     NUMERIC NOT NULL DEFAULT 5000,
  sea_rate     NUMERIC NOT NULL DEFAULT 180000,
  courier_rate NUMERIC NOT NULL DEFAULT 1200,
  road_rate    NUMERIC NOT NULL DEFAULT 500,

  -- fixed charges per shipment (PKR)
  documentation   NUMERIC NOT NULL DEFAULT 0,
  bank_charges    NUMERIC NOT NULL DEFAULT 0,
  clearing        NUMERIC NOT NULL DEFAULT 0,
  local_transport NUMERIC NOT NULL DEFAULT 0,

  -- tax / insurance %
  gst_percent       NUMERIC NOT NULL DEFAULT 18,
  wht_percent       NUMERIC NOT NULL DEFAULT 5,
  insurance_percent NUMERIC NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT costing_config_singleton CHECK (id = 1)
);

-- seed the single row from engine defaults
INSERT INTO costing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── RLS: admin + sales read; admin only writes ──────────────────────────────
ALTER TABLE costing_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'costing_config' AND policyname = 'costing_config_read') THEN
    CREATE POLICY "costing_config_read" ON costing_config FOR SELECT
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'costing_config' AND policyname = 'costing_config_write') THEN
    CREATE POLICY "costing_config_write" ON costing_config FOR UPDATE
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'costing_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE costing_config;
  END IF;
END $$;
