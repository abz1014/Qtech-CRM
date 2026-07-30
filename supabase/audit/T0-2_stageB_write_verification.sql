-- ============================================================================
-- T0-2 STAGE B — WRITE-PATH VERIFICATION (safe, self-cleaning, zero residue)
-- ============================================================================
-- Everything runs inside ONE transaction that ends in ROLLBACK. Nothing is
-- ever committed to real data, regardless of pass or fail.
--
-- ⚠ RUN SETTINGS: leave the SQL Editor on the DEFAULT role (postgres) and do
--   NOT enable any "test with RLS / impersonate role" toggle. This script does
--   its own role switching internally and needs to start as postgres.
--
-- WHAT THIS DOES
--   Simulates a real `sales` user and a real `engineer` user the same way
--   PostgREST does per HTTP request: auth.uid() reads the `request.jwt.claims`
--   session setting, and the Postgres role is switched to `authenticated`.
--   Every write the app performs is then attempted through the REAL RLS
--   policies and logged PASS / FAIL.
--
--   RLS denies UPDATE/DELETE SILENTLY (0 rows, no error), so every test that
--   could be silently no-opped re-checks the row afterward via GET DIAGNOSTICS
--   or a re-SELECT -- never just "did it throw".
--
--   NEGATIVE CONTROL (test 02): sales attempts to delete an order (admin-only).
--   If that succeeds it is reported as SECURITY FAILURE, and every other
--   result in the run should be treated as suspect.
--
-- DESIGN NOTES (why it looks like this)
--   * IDs are held in transaction-local session variables via set_config(...,
--     true) rather than a temp table: GUCs need no GRANT, are readable by any
--     role, and are discarded automatically on ROLLBACK.
--   * The results log is a schema-qualified ordinary table created inside the
--     transaction (not a TEMP table). Temp objects live in a per-session
--     pg_temp_N schema whose visibility and privileges get awkward across a
--     SET ROLE, which is what broke earlier revisions of this script.
--     Because it is created inside the transaction, ROLLBACK removes it.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Results log. Created inside the transaction -> removed by ROLLBACK.
-- clock_timestamp() (not now(), which is frozen per transaction) advances on
-- every call, giving a reliable ordering without a sequence to grant.
-- ---------------------------------------------------------------------------
CREATE TABLE public.__rls_test_log (
  logged_at timestamptz DEFAULT clock_timestamp(),
  test_name text,
  result    text,
  detail    text
);
GRANT SELECT, INSERT ON public.__rls_test_log TO authenticated;
-- No RLS is enabled on this table, so `authenticated` can write to it freely.


-- ---------------------------------------------------------------------------
-- Capture real IDs while still `postgres` (bypasses RLS -> trustworthy baseline)
-- ---------------------------------------------------------------------------
SELECT set_config('rlstest.sales_id',    COALESCE((SELECT id::text FROM public.users     WHERE role = 'sales'    LIMIT 1), ''), true);
SELECT set_config('rlstest.engineer_id', COALESCE((SELECT id::text FROM public.users     WHERE role = 'engineer' LIMIT 1), ''), true);
SELECT set_config('rlstest.client_id',   COALESCE((SELECT id::text FROM public.clients   LIMIT 1), ''), true);
SELECT set_config('rlstest.vendor_id',   COALESCE((SELECT id::text FROM public.vendors   LIMIT 1), ''), true);
SELECT set_config('rlstest.rfq_id',      COALESCE((SELECT id::text FROM public.rfqs      LIMIT 1), ''), true);
SELECT set_config('rlstest.order_id',    COALESCE((SELECT id::text FROM public.orders    LIMIT 1), ''), true);
SELECT set_config('rlstest.prospect_id', COALESCE((SELECT id::text FROM public.prospects LIMIT 1), ''), true);
SELECT set_config('rlstest.oe_id',       '', true);   -- filled in by test 15

-- Prechecks
INSERT INTO public.__rls_test_log (test_name, result, detail)
SELECT '00. precheck: a sales user exists',
       CASE WHEN current_setting('rlstest.sales_id', true) = '' THEN 'FAIL' ELSE 'PASS' END,
       CASE WHEN current_setting('rlstest.sales_id', true) = ''
            THEN 'no user with role=sales; every sales test below is meaningless'
            ELSE current_setting('rlstest.sales_id', true) END;

INSERT INTO public.__rls_test_log (test_name, result, detail)
SELECT '00. precheck: an engineer user exists',
       CASE WHEN current_setting('rlstest.engineer_id', true) = '' THEN 'FAIL' ELSE 'PASS' END,
       CASE WHEN current_setting('rlstest.engineer_id', true) = ''
            THEN 'no user with role=engineer; test 17 is meaningless'
            ELSE current_setting('rlstest.engineer_id', true) END;

INSERT INTO public.__rls_test_log (test_name, result, detail)
SELECT '00. precheck: a prospect exists',
       CASE WHEN current_setting('rlstest.prospect_id', true) = '' THEN 'SKIP' ELSE 'PASS' END,
       CASE WHEN current_setting('rlstest.prospect_id', true) = ''
            THEN 'no prospects in DB; test 05 will be skipped (not a failure)'
            ELSE current_setting('rlstest.prospect_id', true) END;


-- ===========================================================================
-- IMPERSONATE: sales
-- ===========================================================================
SELECT set_config('request.jwt.claims',
       json_build_object('sub', current_setting('rlstest.sales_id', true),
                         'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

INSERT INTO public.__rls_test_log (test_name, result, detail)
SELECT '01. sanity: impersonating sales', 'INFO',
       'auth.uid=' || COALESCE(auth.uid()::text, 'NULL') ||
       '  current_user_role()=' || COALESCE(public.current_user_role(), 'NULL') ||
       '  session_user_role=' || current_user;


-- 02. NEGATIVE CONTROL — sales must NOT be able to delete an order
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.order_id', true), '')::uuid;
        v_remaining int;
BEGIN
  DELETE FROM public.orders WHERE id = v_id;
  SELECT count(*) INTO v_remaining FROM public.orders WHERE id = v_id;
  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: sales deleted an order (must be admin-only)';
  END IF;
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES
    ('02. NEG CONTROL: sales cannot DELETE orders', 'PASS', 'order survived the denied delete, as expected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES
    ('02. NEG CONTROL: sales cannot DELETE orders',
     CASE WHEN SQLERRM LIKE 'SECURITY FAILURE%' THEN 'SECURITY FAILURE' ELSE 'PASS (blocked by policy)' END,
     SQLERRM);
END $$;


-- 03. clients: Add Client
DO $$
BEGIN
  INSERT INTO public.clients (company_name, created_by)
  VALUES ('__RLS_TEST__', NULLIF(current_setting('rlstest.sales_id', true), '')::uuid);
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('03. sales: INSERT clients (Add Client)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('03. sales: INSERT clients (Add Client)', 'FAIL', SQLERRM);
END $$;


-- 04. clients: edit
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.client_id', true), '')::uuid;
        v_industry text; v_rows int;
BEGIN
  SELECT industry INTO v_industry FROM public.clients WHERE id = v_id;
  UPDATE public.clients SET industry = v_industry WHERE id = v_id;  -- same value; exercises USING + WITH CHECK
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'SILENT NO-OP: 0 rows affected (RLS USING filtered the row out)'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('04. sales: UPDATE clients (edit client)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('04. sales: UPDATE clients (edit client)', 'FAIL', SQLERRM);
END $$;


-- 05. prospects: mark converted (the duplicate-client corruption path)
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.prospect_id', true), '')::uuid;
        v_rows int;
BEGIN
  IF v_id IS NULL THEN
    INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES
      ('05. sales: UPDATE prospects (mark converted)', 'SKIPPED', 'no prospects exist to test against');
    RETURN;
  END IF;
  UPDATE public.prospects SET converted_client_id = converted_client_id WHERE id = v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'SILENT NO-OP: 0 rows affected -- this is exactly the duplicate-client bug path'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('05. sales: UPDATE prospects (mark converted)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('05. sales: UPDATE prospects (mark converted)', 'FAIL', SQLERRM);
END $$;


-- 06. vendors: inline create mid-order (app THROWS on failure -> kills whole form)
DO $$
BEGIN
  INSERT INTO public.vendors (name) VALUES ('__RLS_TEST__');
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('06. sales: INSERT vendors (inline create mid-order)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('06. sales: INSERT vendors (inline create mid-order)', 'FAIL', SQLERRM);
END $$;


-- 07. vendors: edit
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.vendor_id', true), '')::uuid; v_rows int;
BEGIN
  UPDATE public.vendors SET country = country WHERE id = v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'SILENT NO-OP: 0 rows affected'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('07. sales: UPDATE vendors (edit vendor)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('07. sales: UPDATE vendors (edit vendor)', 'FAIL', SQLERRM);
END $$;


-- 08. rfqs: create
DO $$
BEGIN
  INSERT INTO public.rfqs (client_id, assigned_to)
  VALUES (NULLIF(current_setting('rlstest.client_id', true), '')::uuid,
          NULLIF(current_setting('rlstest.sales_id',  true), '')::uuid);
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('08. sales: INSERT rfqs (create RFQ)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('08. sales: INSERT rfqs (create RFQ)', 'FAIL', SQLERRM);
END $$;


-- 09. rfqs: change status
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.rfq_id', true), '')::uuid; v_rows int;
BEGIN
  UPDATE public.rfqs SET status = status WHERE id = v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'SILENT NO-OP: 0 rows affected'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('09. sales: UPDATE rfqs (change status)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('09. sales: UPDATE rfqs (change status)', 'FAIL', SQLERRM);
END $$;


-- 10. rfq_line_items: create-then-delete round trip on OUR OWN row (never touches real line items)
DO $$
DECLARE v_new uuid; v_remaining int;
BEGIN
  INSERT INTO public.rfq_line_items (rfq_id, specification)
  VALUES (NULLIF(current_setting('rlstest.rfq_id', true), '')::uuid, '__RLS_TEST__')
  RETURNING id INTO v_new;
  DELETE FROM public.rfq_line_items WHERE id = v_new;
  SELECT count(*) INTO v_remaining FROM public.rfq_line_items WHERE id = v_new;
  IF v_remaining > 0 THEN RAISE EXCEPTION 'SILENT NO-OP on DELETE: row still present afterward'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('10. sales: INSERT+DELETE rfq_line_items', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('10. sales: INSERT+DELETE rfq_line_items', 'FAIL', SQLERRM);
END $$;


-- 11. supplier_inquiries: float an RFQ to a vendor
DO $$
BEGIN
  INSERT INTO public.supplier_inquiries (rfq_id, vendor_id)
  VALUES (NULLIF(current_setting('rlstest.rfq_id',    true), '')::uuid,
          NULLIF(current_setting('rlstest.vendor_id', true), '')::uuid);
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('11. sales: INSERT supplier_inquiries (float RFQ)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('11. sales: INSERT supplier_inquiries (float RFQ)', 'FAIL', SQLERRM);
END $$;


-- 12. supplier_quotes: record a quote, then pick it as winner
DO $$
DECLARE v_new uuid; v_selected boolean;
BEGIN
  INSERT INTO public.supplier_quotes (rfq_id, vendor_id, unit_price)
  VALUES (NULLIF(current_setting('rlstest.rfq_id',    true), '')::uuid,
          NULLIF(current_setting('rlstest.vendor_id', true), '')::uuid, 1)
  RETURNING id INTO v_new;
  UPDATE public.supplier_quotes SET is_selected = true WHERE id = v_new;
  SELECT is_selected INTO v_selected FROM public.supplier_quotes WHERE id = v_new;
  IF v_selected IS NOT TRUE THEN RAISE EXCEPTION 'SILENT NO-OP: is_selected not set after UPDATE'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('12. sales: INSERT+UPDATE supplier_quotes (pick winner)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('12. sales: INSERT+UPDATE supplier_quotes (pick winner)', 'FAIL', SQLERRM);
END $$;


-- 13. cost_lines: the DELETE-then-INSERT duplication risk (mirrors saveCostLines)
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.order_id', true), '')::uuid;
        v_before int; v_after int;
BEGIN
  SELECT count(*) INTO v_before FROM public.cost_lines WHERE order_id = v_id;
  DELETE FROM public.cost_lines WHERE order_id = v_id;
  INSERT INTO public.cost_lines (order_id, item) VALUES (v_id, '__RLS_TEST__');
  SELECT count(*) INTO v_after FROM public.cost_lines WHERE order_id = v_id;
  IF v_after > v_before THEN
    RAISE EXCEPTION 'DUPLICATION DETECTED: before=% after=% (DELETE silently no-opped, INSERT still applied)', v_before, v_after;
  END IF;
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES
    ('13. sales: cost_lines DELETE-then-INSERT (costing save)', 'PASS', format('before=%s after=%s', v_before, v_after));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES
    ('13. sales: cost_lines DELETE-then-INSERT (costing save)', 'FAIL', SQLERRM);
END $$;


-- 14. orders: status advance
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.order_id', true), '')::uuid; v_rows int;
BEGIN
  UPDATE public.orders SET status = status WHERE id = v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'SILENT NO-OP: 0 rows affected'; END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('14. sales: UPDATE orders (status advance)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('14. sales: UPDATE orders (status advance)', 'FAIL', SQLERRM);
END $$;


-- 15. FIXTURE (as sales): assign the engineer to an order. This is what
--     sales/admin does; the engineer never inserts this row themselves.
DO $$
DECLARE v_new uuid;
BEGIN
  INSERT INTO public.order_engineers (order_id, engineer_id, commissioning_status)
  VALUES (NULLIF(current_setting('rlstest.order_id',    true), '')::uuid,
          NULLIF(current_setting('rlstest.engineer_id', true), '')::uuid, 'pending')
  RETURNING id INTO v_new;
  PERFORM set_config('rlstest.oe_id', v_new::text, true);
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('15. sales: INSERT order_engineers (assign engineer)', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('15. sales: INSERT order_engineers (assign engineer)', 'FAIL', SQLERRM);
END $$;


-- ===========================================================================
-- IMPERSONATE: engineer  (Postgres role stays `authenticated`; the app role
-- is distinguished only by public.users.role via current_user_role())
-- ===========================================================================
SELECT set_config('request.jwt.claims',
       json_build_object('sub', current_setting('rlstest.engineer_id', true),
                         'role', 'authenticated')::text, true);

INSERT INTO public.__rls_test_log (test_name, result, detail)
SELECT '16. sanity: impersonating engineer', 'INFO',
       'auth.uid=' || COALESCE(auth.uid()::text, 'NULL') ||
       '  current_user_role()=' || COALESCE(public.current_user_role(), 'NULL');


-- 17. order_engineers: engineer advances the status of THEIR OWN assignment
DO $$
DECLARE v_id uuid := NULLIF(current_setting('rlstest.oe_id', true), '')::uuid; v_status text;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no fixture row from test 15 -- that test must PASS first for this to be meaningful';
  END IF;
  UPDATE public.order_engineers SET commissioning_status = 'in_progress' WHERE id = v_id;
  SELECT commissioning_status INTO v_status FROM public.order_engineers WHERE id = v_id;
  IF v_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'SILENT NO-OP: status is % (expected in_progress) -- the whole engineer role depends on this',
                    COALESCE(v_status, 'NULL/not visible');
  END IF;
  INSERT INTO public.__rls_test_log (test_name, result) VALUES ('17. engineer: advance own commissioning status', 'PASS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.__rls_test_log (test_name, result, detail) VALUES ('17. engineer: advance own commissioning status', 'FAIL', SQLERRM);
END $$;


-- ===========================================================================
-- RESULTS  (back to postgres so the log is fully readable)
-- ===========================================================================
RESET ROLE;

SELECT test_name, result, COALESCE(detail, '') AS detail
FROM public.__rls_test_log
ORDER BY logged_at;

-- Nothing above is kept: the log table, the GUCs and every test write are all
-- discarded here.
ROLLBACK;
