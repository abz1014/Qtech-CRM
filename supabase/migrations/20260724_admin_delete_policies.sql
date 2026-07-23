-- ============================================================================
-- 2026-07-24 · Admin DELETE policies for core records
-- Orders already had an admin delete policy (20260710). This adds the same for
-- rfqs, clients, vendors and prospects so an admin can delete those records from
-- the app. Without these, RLS silently blocks the delete (0 rows) and the record
-- reappears on refresh. Admin only. Idempotent — safe to run repeatedly.
--
-- Note: deleting a client cascades (in app code) to that client's orders + RFQs,
-- which is why these three tables all need the policy for a client delete to work.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rfqs' AND policyname = 'rfqs_delete_admin') THEN
    CREATE POLICY "rfqs_delete_admin" ON rfqs FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'clients_delete_admin') THEN
    CREATE POLICY "clients_delete_admin" ON clients FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'vendors_delete_admin') THEN
    CREATE POLICY "vendors_delete_admin" ON vendors FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prospects' AND policyname = 'prospects_delete_admin') THEN
    CREATE POLICY "prospects_delete_admin" ON prospects FOR DELETE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
