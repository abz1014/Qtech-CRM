-- ============================================================================
-- 2026-07-11 · Finance rebuild (Sprint 7) — lean, order-centric, ADMIN-ONLY
-- Decisions (Product Bible §14):
--   * Customer payments: partial payments tracked per order (order_payments)
--   * Supplier payments: tracked per order incl. advances (supplier_payments)
--   * Expenses: REUSES the existing `expenses` table — no new schema
--   * Invoices: one per order — two fields on orders, no ledger, no documents
-- Safe to run repeatedly.
-- ============================================================================

-- ── 1. Invoice fields on orders (one order = one invoice, data only) ────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_date TEXT;

-- ── 2. Customer payments (money IN, against an order) ───────────────────────
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_date ON order_payments(payment_date);

-- ── 3. Supplier payments (money OUT, against an order — incl. advances) ─────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_order ON supplier_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- ── 4. RLS — finance is ADMIN-ONLY (read AND write) ─────────────────────────
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_payments' AND policyname = 'order_payments_admin_all') THEN
    CREATE POLICY "order_payments_admin_all" ON order_payments FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_payments' AND policyname = 'supplier_payments_admin_all') THEN
    CREATE POLICY "supplier_payments_admin_all" ON supplier_payments FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── 5. Realtime ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_payments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'supplier_payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE supplier_payments;
  END IF;
END $$;
