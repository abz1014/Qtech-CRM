-- ============================================================================
-- T0-2 STEP 2C — REPLACE `allow_auth_*` ON THE FINANCE TABLES
-- ============================================================================
-- Ticket: T0-2 (stage C of C)  |  Prereq: stages A + B applied and verified
-- Date:   2026-07-29
--
-- THE PROBLEM THIS FIXES
--   Six finance tables carry policies of the form:
--       allow_auth_<t>  FOR ALL  USING (auth.uid() IS NOT NULL)   [no WITH CHECK]
--   On a FOR ALL policy with WITH CHECK omitted, Postgres reuses the USING
--   expression as the write check. So EVERY logged-in user of ANY role can
--   currently SELECT, INSERT, UPDATE and DELETE:
--       invoices · expenses · payment_records · payables · budgets · follow_up_actions
--
--   Concretely, today a sales user could read every invoice and salary figure,
--   and DELETE payment_records -- destroying the cash-receipt audit trail.
--
-- WHY TIGHTENING READS TO ADMIN IS SAFE (no app impact)
--   CRMContext loads all of these behind an isAdmin gate
--   (CRMContext.tsx:275-282: `isAdmin ? supabase.from(...) : emptyResult`),
--   and the realtime subscriptions for them sit inside the same isAdmin block.
--   /finance is RequireRole ['admin'] (App.tsx). Sales and engineer sessions
--   never request these tables, so restricting them to admin changes nothing
--   the app actually does -- it only closes direct API access.
--
--   THE ONE EXCEPTION: follow_up_actions must stay open to `authenticated`.
--   The Actions page is used by sales, auto-generated follow-ups are written
--   with assigned_to possibly NULL (CRMContext.tsx:719), and any user may
--   complete or snooze an unassigned action (ActionsPage.tsx:610).
--
-- ACCESS MATRIX (source: call-site trace)
--   table               SELECT         INSERT  UPDATE  DELETE
--   invoices            admin          admin   admin   admin
--   expenses            admin          admin   admin   admin
--   payment_records     admin          admin   (none)  (none)   <- append-only
--   payables            admin          admin   admin   admin
--   payable_payments    admin          admin   (none)  (none)   <- append-only
--   recurring_expenses  admin          admin   admin   admin
--   budgets             (none)         (none)  (none)  (none)   <- unused table
--   follow_up_actions   authenticated  auth    auth    auth
--   quarterly_targets   authenticated  admin   admin   (none)
--
-- DELIBERATE OMISSIONS -- these gaps are CORRECT, do not "fix" them later:
--   * payment_records / payable_payments UPDATE+DELETE: the app only ever
--     INSERTs (verified: zero .update()/.delete() call sites). Append-only is
--     the intended shape for a payment ledger; adding them is pure attack
--     surface and would re-enable the "engineer deletes the audit trail" hole.
--   * budgets: ZERO `.from('budgets')` calls exist anywhere in src (verified
--     twice, independently). The Budget type is dead scaffolding. Dropping its
--     only policy and authoring none leaves RLS-on + no-policy = FAIL CLOSED,
--     which is the correct end state for an unused table. Recorded here so a
--     future reviewer does not "helpfully" add policies back.
--   * quarterly_targets DELETE: no call site.
--
-- ALSO FIXED HERE
--   quarterly_targets_select was `USING (true)` with no TO clause -- company
--   revenue targets were readable by PUBLIC. Now scoped TO authenticated.
--   (The upsert at DashboardPage.tsx:243 needs BOTH admin INSERT and admin
--   UPDATE; dropping either half breaks target editing on the second save.)
--
-- REVERSIBILITY: 20260729_t0_step2c_finance_policies_ROLLBACK.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — SNAPSHOT (read-only; save before proceeding)
-- ----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('invoices','expenses','payment_records','payables','budgets',
                    'follow_up_actions','payable_payments','recurring_expenses',
                    'quarterly_targets')
ORDER BY tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- STEP 1 — Clear existing policies on those tables (deterministic end state)
-- ----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('invoices','expenses','payment_records','payables','budgets',
                        'follow_up_actions','payable_payments','recurring_expenses',
                        'quarterly_targets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- STEP 2 — Author the replacements
-- ----------------------------------------------------------------------------

-- invoices --------------------------------------------------------------------
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated
  USING      (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- expenses --------------------------------------------------------------------
-- Includes category='Salaries' rows -- payroll must not be staff-readable.
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated
  USING      (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY expenses_delete ON public.expenses FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- payment_records -------------------------------------------------------------
-- APPEND-ONLY BY DESIGN. No UPDATE, no DELETE policy: the app never issues
-- either (verified), and their absence is what stops a non-admin -- or an
-- admin mistake -- from erasing cash-receipt history.
CREATE POLICY payment_records_select ON public.payment_records FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY payment_records_insert ON public.payment_records FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- payables --------------------------------------------------------------------
CREATE POLICY payables_select ON public.payables FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY payables_insert ON public.payables FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY payables_update ON public.payables FOR UPDATE TO authenticated
  USING      (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY payables_delete ON public.payables FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- payable_payments ------------------------------------------------------------
-- Append-only, same reasoning as payment_records.
CREATE POLICY payable_payments_select ON public.payable_payments FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY payable_payments_insert ON public.payable_payments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- recurring_expenses ----------------------------------------------------------
-- Holds salary templates (label + monthly amount) -> admin-only read.
CREATE POLICY recurring_expenses_select ON public.recurring_expenses FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
CREATE POLICY recurring_expenses_insert ON public.recurring_expenses FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY recurring_expenses_update ON public.recurring_expenses FOR UPDATE TO authenticated
  USING      (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY recurring_expenses_delete ON public.recurring_expenses FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- budgets ---------------------------------------------------------------------
-- INTENTIONALLY NO POLICIES. Zero `.from('budgets')` calls exist in src.
-- RLS is enabled, so no policy = fail closed = table unreachable from the API.
-- If a budgeting feature is ever built, add policies THEN, not now.

-- follow_up_actions -----------------------------------------------------------
-- MUST stay open to authenticated: sales uses the Actions page; auto-created
-- follow-ups may have assigned_to = NULL; any user may complete/snooze an
-- unassigned action. This mirrors current effective behaviour, so no regression.
CREATE POLICY follow_up_actions_select ON public.follow_up_actions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY follow_up_actions_insert ON public.follow_up_actions FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY follow_up_actions_update ON public.follow_up_actions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY follow_up_actions_delete ON public.follow_up_actions FOR DELETE TO authenticated
  USING (true);

-- quarterly_targets -----------------------------------------------------------
-- Was USING (true) with no TO clause -> readable by PUBLIC. Now authenticated.
-- The dashboard upsert needs BOTH INSERT and UPDATE for admin.
CREATE POLICY quarterly_targets_select ON public.quarterly_targets FOR SELECT TO authenticated
  USING (true);
CREATE POLICY quarterly_targets_insert ON public.quarterly_targets FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY quarterly_targets_update ON public.quarterly_targets FOR UPDATE TO authenticated
  USING      (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');


-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY
-- ----------------------------------------------------------------------------
-- (a) No `allow_auth_*` policies anywhere. Expect 0.
SELECT count(*) AS allow_auth_remaining,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'NOT APPLIED' END AS verdict
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'allow_auth%';

-- (b) No permissive nullifiers left on ANY table (allow_all + allow_auth + read-alls). Expect 0.
SELECT count(*) AS permissive_remaining
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname LIKE 'allow_%'
    OR (cmd = 'ALL' AND btrim(COALESCE(qual,'')) IN ('true','(true)')));

-- (c) budgets must have ZERO policies (intended fail-closed). Expect 0.
SELECT count(*) AS budgets_policies FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'budgets';

-- (d) Full resulting set for review.
SELECT tablename, cmd, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('invoices','expenses','payment_records','payables','budgets',
                    'follow_up_actions','payable_payments','recurring_expenses',
                    'quarterly_targets')
ORDER BY tablename, cmd;


-- ============================================================================
-- ⛔ TEST AFTER APPLYING (as ADMIN -- the only role that touches finance):
--      1. /finance loads: invoices, expenses, AR/AP aging, cashflow
--      2. Add an expense, then delete it
--      3. Record a payment against an invoice
--      4. Toggle a recurring expense active/inactive
--      5. Dashboard: edit a quarterly target, save, reload, save AGAIN
--         (the second save is the UPDATE half of the upsert)
--      6. As SALES: /actions still lists, completes and snoozes follow-ups
-- ============================================================================
