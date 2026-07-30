-- ============================================================================
-- T0-2 STEP 2B — REPLACE `allow_all` ON THE 9 REMAINING CORE CRM TABLES
-- ============================================================================
-- Ticket: T0-2 (stage B of D)   |   Prereq: stage A applied and login verified
-- Date:   2026-07-29
--
-- WHAT THIS DOES
--   Drops `allow_all (FOR ALL TO public USING true WITH CHECK true)` from the
--   9 core CRM tables and replaces it with least-privilege, role-gated policies
--   derived from an exhaustive trace of every `.from()` call in src/.
--
-- WHY THE ROLE GATES LOOK LIKE THIS
--   Every gate uses public.current_user_role() (created in stage A), NOT an
--   inline `(SELECT role FROM users ...)` subquery. Inline subqueries against
--   `users` are what caused the 42P17 recursion; the SECURITY DEFINER helper
--   also lets Postgres evaluate the role once per statement instead of per row.
--
--   NO policy references `created_by`. The original enable_rls_security_policies.sql
--   predicated INSERT/UPDATE on `created_by = auth.uid()` for orders, rfqs,
--   supplier_inquiries and supplier_quotes -- but NONE of those tables has a
--   `created_by` column (schema.sql:54-137; orders has sales_person_id, rfqs has
--   assigned_to) and the app never sends one. Those CREATE POLICY statements
--   could never execute. All replacements here are role-only.
--
-- ACCESS MATRIX (source: call-site trace, evidence in supabase/audit/)
--   table               SELECT         INSERT        UPDATE                     DELETE
--   clients             authenticated  admin+sales   admin+sales                admin
--   prospects           authenticated  admin+sales   admin+sales                admin
--   vendors             authenticated  admin+sales   admin+sales                admin
--   orders              authenticated  admin+sales   admin+sales                admin
--   order_engineers     authenticated  admin+sales   own-row engineer OR staff  (none)
--   rfqs                authenticated  admin+sales   admin+sales                admin
--   rfq_line_items      authenticated  admin+sales   admin+sales                admin+sales
--   supplier_inquiries  authenticated  admin+sales   admin+sales                (none)
--   supplier_quotes     authenticated  admin+sales   admin+sales                (none)
--
-- DELIBERATE OMISSIONS -- do NOT "fix" these later:
--   * supplier_inquiries / supplier_quotes DELETE: the app never deletes them.
--     Their rfq_id FK is ON DELETE CASCADE (schema.sql:113,:125) and FK cascades
--     are NOT filtered by RLS, so RFQ deletion still cleans them up.
--   * order_engineers DELETE: no call site; cascades from orders.
--   * SELECT is `authenticated` (not narrower) everywhere here because
--     CRMContext.tsx:262-266 loads these tables UNGATED for every role, and
--     lookup maps (getClientName / getVendorName, CRMContext.tsx:671) resolve
--     names across pages for all roles.
--
-- KNOWN SILENT-FAILURE RISK
--   RLS returns 0 rows with error === null. CRMContext's `if (error) throw`
--   guards therefore CANNOT detect a policy mismatch, and optimistic
--   setState still updates the UI. Every change below must be verified by
--   ACTION in the app, not by absence of an error toast.
--
-- REVERSIBILITY: 20260729_t0_step2b_core_crm_policies_ROLLBACK.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — SNAPSHOT (read-only; save before proceeding)
-- ----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients','prospects','vendors','orders','order_engineers',
                    'rfqs','rfq_line_items','supplier_inquiries','supplier_quotes')
ORDER BY tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- STEP 1 — Clear existing policies on those 9 tables (deterministic end state)
-- ----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('clients','prospects','vendors','orders','order_engineers',
                        'rfqs','rfq_line_items','supplier_inquiries','supplier_quotes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- STEP 2 — Author the replacement policies
-- ----------------------------------------------------------------------------

-- clients ---------------------------------------------------------------------
-- INSERT must include sales: ClientsPage.tsx:61 (Add Client, not role-gated) and
-- CRMContext.tsx:820 inside convertProspect.
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- prospects -------------------------------------------------------------------
-- UPDATE must include sales, or convertProspect inserts the client (CRMContext.tsx:820)
-- then silently fails to mark the prospect converted (:831) -> DUPLICATE CLIENTS.
CREATE POLICY prospects_select ON public.prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY prospects_insert ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY prospects_update ON public.prospects FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY prospects_delete ON public.prospects FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- vendors ---------------------------------------------------------------------
-- INSERT must include sales: inline vendor creation from OrdersPage.tsx:134 and
-- RFQDetailPage.tsx:153. CRMContext.tsx:795 THROWS on failure, so a missing
-- policy aborts the whole order/inquiry form, not just the vendor.
CREATE POLICY vendors_select ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY vendors_insert ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY vendors_update ON public.vendors FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY vendors_delete ON public.vendors FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- orders ----------------------------------------------------------------------
-- UPDATE is load-bearing for: status advance (OrderDetailPage.tsx:259),
-- edit (OrdersPage.tsx:184), ops dismiss (OperationsPage.tsx:75), and
-- addOrderPayment's status flip to payment_received (CRMContext.tsx:1677).
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- order_engineers -------------------------------------------------------------
-- UPDATE carries the ENTIRE engineer role: MyJobsPage.tsx:75 advances
-- commissioning status. Engineers may update only their own assignment.
CREATE POLICY order_engineers_select ON public.order_engineers FOR SELECT TO authenticated USING (true);
CREATE POLICY order_engineers_insert ON public.order_engineers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY order_engineers_update ON public.order_engineers FOR UPDATE TO authenticated
  USING      (engineer_id = auth.uid() OR public.current_user_role() IN ('admin','sales'))
  WITH CHECK (engineer_id = auth.uid() OR public.current_user_role() IN ('admin','sales'));

-- rfqs ------------------------------------------------------------------------
CREATE POLICY rfqs_select ON public.rfqs FOR SELECT TO authenticated USING (true);
CREATE POLICY rfqs_insert ON public.rfqs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY rfqs_update ON public.rfqs FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY rfqs_delete ON public.rfqs FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- rfq_line_items --------------------------------------------------------------
-- Sales genuinely deletes line items from RFQDetailPage.
CREATE POLICY rfq_line_items_select ON public.rfq_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY rfq_line_items_insert ON public.rfq_line_items FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY rfq_line_items_update ON public.rfq_line_items FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY rfq_line_items_delete ON public.rfq_line_items FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin','sales'));

-- supplier_inquiries ----------------------------------------------------------
CREATE POLICY supplier_inquiries_select ON public.supplier_inquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_inquiries_insert ON public.supplier_inquiries FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY supplier_inquiries_update ON public.supplier_inquiries FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));

-- supplier_quotes -------------------------------------------------------------
-- UPDATE covers selecting the winning quote (is_selected).
CREATE POLICY supplier_quotes_select ON public.supplier_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_quotes_insert ON public.supplier_quotes FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin','sales'));
CREATE POLICY supplier_quotes_update ON public.supplier_quotes FOR UPDATE TO authenticated
  USING      (public.current_user_role() IN ('admin','sales'))
  WITH CHECK (public.current_user_role() IN ('admin','sales'));


-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY
-- ----------------------------------------------------------------------------
-- Expect ZERO rows (no permissive policy left on these tables)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients','prospects','vendors','orders','order_engineers',
                    'rfqs','rfq_line_items','supplier_inquiries','supplier_quotes')
  AND (qual IS NULL AND cmd <> 'INSERT' OR btrim(COALESCE(qual,'')) IN ('true','(true)') AND cmd <> 'SELECT');

-- Full resulting policy set for review
SELECT tablename, cmd, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients','prospects','vendors','orders','order_engineers',
                    'rfqs','rfq_line_items','supplier_inquiries','supplier_quotes')
ORDER BY tablename, cmd;


-- ============================================================================
-- ⛔ STOP AND TEST BEFORE STAGE C.
--    As ADMIN:    dashboard loads; edit a client; delete cascade still works.
--    As SALES:    add client, convert prospect, inline-create vendor mid-order,
--                 create RFQ, change RFQ status, add supplier quote, pick
--                 winner, delete a line item, SAVE A COSTING (see below).
--    As ENGINEER: change a commissioning status on My Jobs.
--
--    ⚠ Costing save is the highest-risk check: saveCostLines does DELETE then
--      INSERT (CRMContext.tsx:1716 -> :1722). If sales lacks DELETE on
--      cost_lines the delete affects 0 rows with NO error and the sheet is
--      DUPLICATED rather than replaced. cost_lines is untouched by this stage
--      (its cost_lines_rw admin+sales policy already exists) -- verify anyway.
-- ============================================================================
