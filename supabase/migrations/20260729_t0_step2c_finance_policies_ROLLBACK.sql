-- ============================================================================
-- ROLLBACK for 20260729_t0_step2c_finance_policies.sql
-- ============================================================================
-- Restores the `allow_auth_*` policies on the six finance tables, returning
-- them to their previous (insecure but working) behaviour.
--
-- ⚠️  This re-opens: any logged-in user of any role can read every invoice and
--     salary figure, and can DELETE payment_records (destroying the cash
--     receipt audit trail). Treat as a temporary emergency measure only.
--
-- `anon` remains revoked from step 1, so this does NOT reopen anonymous access.
--
-- Prefer a targeted fix: if only one operation broke, tell me the table, the
-- role and the action, and I will correct that single policy instead.
-- ============================================================================

DO $$
DECLARE t text; suffix text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','expenses','payment_records','payables',
                           'budgets','follow_up_actions']
  LOOP
    suffix := CASE t WHEN 'follow_up_actions' THEN 'followups' ELSE t END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'allow_auth_' || suffix, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() IS NOT NULL)',
      'allow_auth_' || suffix, t);
  END LOOP;
END $$;

-- Restore the previous broad SELECTs on the two tightened tables
DROP POLICY IF EXISTS payable_payments_select ON public.payable_payments;
CREATE POLICY payable_payments_select ON public.payable_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS recurring_expenses_select ON public.recurring_expenses;
CREATE POLICY recurring_read ON public.recurring_expenses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Verify
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'allow_auth%'
ORDER BY tablename;
