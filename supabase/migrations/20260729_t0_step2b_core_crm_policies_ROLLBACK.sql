-- ============================================================================
-- ROLLBACK for 20260729_t0_step2b_core_crm_policies.sql
-- ============================================================================
-- Restores `allow_all` on the 9 core CRM tables, returning them to their
-- previous (insecure but working) behaviour.
--
-- `anon` remains revoked from step 1, so this does NOT reopen anonymous access.
-- The exposure restored is limited to authenticated users.
--
-- Prefer a targeted fix: if only ONE operation broke, tell me which table,
-- which role and which action, and I will correct that single policy instead
-- of reverting all nine.
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','prospects','vendors','orders','order_engineers',
                           'rfqs','rfq_line_items','supplier_inquiries','supplier_quotes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON public.%I', t);
    EXECUTE format('CREATE POLICY allow_all ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Verify: expect 9 rows
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'allow_all'
ORDER BY tablename;
