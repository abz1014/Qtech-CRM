-- ============================================================================
-- 2026-07-24 · Recurring monthly expenses (salaries, utilities, …)
-- A recurring_expenses row is a TEMPLATE (label + category + monthly amount).
-- Each month the admin posts the due templates into the real `expenses` ledger
-- with one click. Idempotency is enforced by (recurring_id, period) so a
-- template can only ever post once per month — clicking "Post" twice is a no-op.
--
-- Posted expenses are ordinary expense rows (editable, counted everywhere);
-- they just carry a back-reference to their template + the YYYY-MM they cover.
-- Admin-only writes; authenticated read (matches the expenses table). Idempotent.
-- ============================================================================

-- ── Recurring expense templates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'Misc'
               CHECK (category IN (
                 'Salaries','Office Expenses','Travel','Equipment',
                 'Software Subscriptions','Utilities','Marketing',
                 'Inventory/Procurement','Misc'
               )),
  amount       NUMERIC NOT NULL DEFAULT 0,
  day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active       BOOLEAN NOT NULL DEFAULT true,
  start_month  TEXT NOT NULL DEFAULT '',   -- YYYY-MM; '' = due from the beginning
  notes        TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Link posted instances back to their template + the month they cover ─────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period TEXT;  -- YYYY-MM this instance covers

-- One instance per template per month (the idempotency guarantee), and the
-- conflict arbiter for the app's upsert. A FULL (non-partial) index is used so
-- supabase-js `upsert({ onConflict: 'recurring_id,period' })` can target it —
-- Postgres won't accept a partial index as an ON CONFLICT arbiter without its
-- predicate, which the client can't supply. Manual expenses carry (NULL, NULL),
-- and NULLs are distinct in a unique index, so they never collide here.
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_recurring_period
  ON expenses(recurring_id, period);

-- ── RLS: authenticated read, admin write (mirrors expenses) ─────────────────
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'recurring_read') THEN
    CREATE POLICY "recurring_read" ON recurring_expenses
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'recurring_insert') THEN
    CREATE POLICY "recurring_insert" ON recurring_expenses
      FOR INSERT WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'recurring_update') THEN
    CREATE POLICY "recurring_update" ON recurring_expenses
      FOR UPDATE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_expenses' AND policyname = 'recurring_delete') THEN
    CREATE POLICY "recurring_delete" ON recurring_expenses
      FOR DELETE USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recurring_expenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE recurring_expenses;
  END IF;
END $$;
