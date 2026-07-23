-- ============================================================================
-- 2026-07-24 · GST Invoice Register
-- One row per GST sales-tax invoice, tracking its full lifecycle in one place:
-- identity → TCS courier → client receipt → FBR sales-tax filing → PSID/deposit.
--
-- Optionally links to a CRM order (order_id) which pre-fills the identity fields;
-- the identity columns are ALSO stored here so the register is self-contained and
-- editable (like the source spreadsheet) even for invoices with no CRM order.
--
-- FBR status is set manually by the accountant (Pending → Generated → Fully
-- Generated → Receipt Received → Deposited). The day-of-month rule (pending 1–5,
-- generated after 5/10, then chase the WASIF & Co receipt) is a UI reminder only.
-- Admin + sales read/write. Idempotent — safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_invoices (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Identity (pre-filled from the linked order, but editable / manual)
  gst_invoice_number      TEXT NOT NULL DEFAULT '',
  invoice_date            TEXT NOT NULL DEFAULT '',   -- YYYY-MM-DD
  client_name             TEXT NOT NULL DEFAULT '',   -- who it was sent to
  supplier_company        TEXT NOT NULL DEFAULT '',   -- came from which company
  customer_po_number      TEXT NOT NULL DEFAULT '',   -- against which PO
  item_name               TEXT NOT NULL DEFAULT '',
  item_number             TEXT NOT NULL DEFAULT '',
  product_detail          TEXT NOT NULL DEFAULT '',
  delivery_challan_number TEXT NOT NULL DEFAULT '',   -- QTS-DC-###
  amount                  NUMERIC NOT NULL DEFAULT 0, -- invoice total (incl GST)
  gst_amount              NUMERIC NOT NULL DEFAULT 0, -- GST portion

  -- TCS courier tracking
  received_date        TEXT NOT NULL DEFAULT '',      -- invoice/goods received/booked
  tcs_sent_date        TEXT NOT NULL DEFAULT '',      -- day we couriered the invoice
  tcs_receipt_number   TEXT NOT NULL DEFAULT '',
  tcs_receipt_date     TEXT NOT NULL DEFAULT '',
  client_received_date TEXT NOT NULL DEFAULT '',      -- client received it via TCS

  -- FBR sales-tax filing
  fbr_status TEXT NOT NULL DEFAULT 'Pending'
             CHECK (fbr_status IN ('Pending','Generated','Fully Generated','Receipt Received','Deposited')),
  wasif_receipt_received BOOLEAN NOT NULL DEFAULT false,  -- FBR receipt from WASIF & Co
  wasif_receipt_date     TEXT NOT NULL DEFAULT '',
  psid                   TEXT NOT NULL DEFAULT '',        -- Payment Slip ID to track the case
  tax_deposit_date       TEXT NOT NULL DEFAULT '',
  tax_deposit_amount     NUMERIC NOT NULL DEFAULT 0,
  tax_deposit_bank       TEXT NOT NULL DEFAULT '',

  notes      TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gst_invoices_order ON gst_invoices(order_id);

-- ── RLS: admin + sales read + write ─────────────────────────────────────────
ALTER TABLE gst_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gst_invoices' AND policyname = 'gst_invoices_rw') THEN
    CREATE POLICY "gst_invoices_rw" ON gst_invoices FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')));
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gst_invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gst_invoices;
  END IF;
END $$;
