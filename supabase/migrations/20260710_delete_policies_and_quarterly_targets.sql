-- ============================================================================
-- 2026-07-10 · Audit remediation migration
-- 1) Adds the DELETE (and missing UPDATE) policies the app actually relies on.
--    The role-based RLS script defined almost no DELETE policies, so deletes
--    from the app silently failed and "deleted rows came back" after reload.
-- 2) Commits the quarterly_targets DDL to the repo (was created ad-hoc from
--    the dashboard with no tracked migration).
-- Safe to run repeatedly: every statement is IF NOT EXISTS / drop-then-create.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- Helper predicate used throughout: caller is an admin
-- (subquery matches the existing policy style in enable_rls_security_policies.sql)

-- ── quarterly_targets (DDL now tracked; policies already exist in prod) ─────
CREATE TABLE IF NOT EXISTS quarterly_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  target_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, quarter)
);
ALTER TABLE quarterly_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quarterly_targets' AND policyname = 'quarterly_targets_select') THEN
    CREATE POLICY "quarterly_targets_select" ON quarterly_targets FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quarterly_targets' AND policyname = 'quarterly_targets_insert') THEN
    CREATE POLICY "quarterly_targets_insert" ON quarterly_targets FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quarterly_targets' AND policyname = 'quarterly_targets_update') THEN
    CREATE POLICY "quarterly_targets_update" ON quarterly_targets FOR UPDATE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quarterly_targets' AND policyname = 'quarterly_targets_delete') THEN
    CREATE POLICY "quarterly_targets_delete" ON quarterly_targets FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── DELETE policies the app depends on ──────────────────────────────────────
-- App delete surface: orders, rfqs (admin-gated in UI), rfq_line_items,
-- invoices, expenses, payables, follow_up_actions, clients, vendors, prospects.

DO $$ BEGIN
  -- orders: admin only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_delete_admin') THEN
    CREATE POLICY "orders_delete_admin" ON orders FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;

  -- invoices / expenses / payables: admin only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_delete_admin') THEN
    CREATE POLICY "invoices_delete_admin" ON invoices FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'expenses_delete_admin') THEN
    CREATE POLICY "expenses_delete_admin" ON expenses FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payables' AND policyname = 'payables_delete_admin') THEN
    CREATE POLICY "payables_delete_admin" ON payables FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;

  -- rfq_line_items: admin + sales may update/delete (the RFQ editor uses both)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rfq_line_items' AND policyname = 'rfq_line_items_update_sales') THEN
    CREATE POLICY "rfq_line_items_update_sales" ON rfq_line_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rfq_line_items' AND policyname = 'rfq_line_items_delete_sales') THEN
    CREATE POLICY "rfq_line_items_delete_sales" ON rfq_line_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sales')));
  END IF;

  -- follow_up_actions: assignee or admin may delete (cascade cleanup + manual delete)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follow_up_actions' AND policyname = 'follow_up_actions_delete') THEN
    CREATE POLICY "follow_up_actions_delete" ON follow_up_actions FOR DELETE USING (
      assigned_to = auth.uid() OR assigned_to IS NULL OR
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── Sanity: list what is now live (paste output into repo docs) ─────────────
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, cmd;
