-- ============================================================================
-- 2026-07-10 · Data-integrity migration #2 (run AFTER the delete-policies one)
-- 1) Cleans up dangling references, then adds the missing foreign keys
-- 2) UNIQUE constraint on invoice numbers (stops duplicate numbering races)
-- 3) Realtime for quarterly_targets (admin target edits propagate live)
-- 4) payable_payments table — persist AP payment history
-- Safe to run repeatedly.
-- ============================================================================

-- ── 1. Clean up dangling references BEFORE adding FKs ──────────────────────
UPDATE orders SET rfq_id = NULL
WHERE rfq_id IS NOT NULL AND rfq_id NOT IN (SELECT id FROM rfqs);

UPDATE rfqs SET converted_order_id = NULL
WHERE converted_order_id IS NOT NULL AND converted_order_id NOT IN (SELECT id FROM orders);

UPDATE invoices SET rfq_id = NULL
WHERE rfq_id IS NOT NULL AND rfq_id NOT IN (SELECT id FROM rfqs);

UPDATE expenses SET rfq_id = NULL
WHERE rfq_id IS NOT NULL AND rfq_id NOT IN (SELECT id FROM rfqs);

-- Orphaned follow-up actions pointing at deleted RFQs/orders
DELETE FROM follow_up_actions
WHERE entity_id IS NOT NULL
  AND entity_type = 'rfq'
  AND entity_id NOT IN (SELECT id FROM rfqs);
DELETE FROM follow_up_actions
WHERE entity_id IS NOT NULL
  AND entity_type = 'order'
  AND entity_id NOT IN (SELECT id FROM orders);

-- ── 2. Add the FKs (idempotent) ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_rfq_id_fkey') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_rfq_id_fkey
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfqs_converted_order_id_fkey') THEN
    ALTER TABLE rfqs ADD CONSTRAINT rfqs_converted_order_id_fkey
      FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_rfq_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_rfq_id_fkey
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_rfq_id_fkey') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_rfq_id_fkey
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes on the new FK columns + hot filters
CREATE INDEX IF NOT EXISTS idx_orders_rfq_id ON orders(rfq_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_client_id ON rfqs(client_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_rfq_date ON rfqs(rfq_date);
CREATE INDEX IF NOT EXISTS idx_followup_entity ON follow_up_actions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_followup_status_due ON follow_up_actions(status, due_date);

-- ── 3. Invoice number uniqueness ────────────────────────────────────────────
-- Deduplicate any existing collisions first (appends -2, -3… to later ones)
DO $$
DECLARE r RECORD; n INT;
BEGIN
  FOR r IN (
    SELECT invoice_number FROM invoices
    GROUP BY invoice_number HAVING COUNT(*) > 1
  ) LOOP
    n := 1;
    UPDATE invoices SET invoice_number = invoice_number || '-' || sub.rn
    FROM (
      SELECT invoice_id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
      FROM invoices WHERE invoice_number = r.invoice_number
    ) sub
    WHERE invoices.invoice_id = sub.invoice_id AND sub.rn > 1;
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_invoice_number_key') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
  END IF;
END $$;

-- ── 4. Realtime for quarterly_targets ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quarterly_targets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE quarterly_targets;
  END IF;
END $$;

-- ── 5. AP payment history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payable_payments (
  payment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payable_id UUID REFERENCES payables(payable_id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT '',
  reference_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payable_payments' AND policyname = 'payable_payments_select') THEN
    CREATE POLICY "payable_payments_select" ON payable_payments FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payable_payments' AND policyname = 'payable_payments_insert') THEN
    CREATE POLICY "payable_payments_insert" ON payable_payments FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
