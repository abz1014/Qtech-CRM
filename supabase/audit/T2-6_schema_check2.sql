-- ============================================================================
-- T2-6 pre-flight, round 2 — audit_log already exists. Inspect it before
-- writing anything. Run each numbered block separately if your SQL editor
-- only shows one result set at a time, and paste back all of them.
-- ============================================================================

-- (A) Existing audit_log columns/types.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- (B) Existing RLS policies on audit_log (must be append-only: no UPDATE/DELETE policy).
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_log';

-- (C) Is RLS even enabled on it?
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'audit_log' AND relnamespace = 'public'::regnamespace;

-- (D) Any triggers already writing INTO audit_log (i.e. is some of T2-6 already done?).
SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- (E) Row count + a few sample rows, so I know if it's live-populated or an empty scaffold.
SELECT count(*) AS row_count FROM public.audit_log;
SELECT * FROM public.audit_log ORDER BY 1 DESC LIMIT 5;

-- (F) Re-run: the column checks on the target tables (orders/order_payments/
--     supplier_payments/gst_invoices/expenses/users) and current_user_role() —
--     only audit_log's own result came back last time, need these too.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_payments', 'supplier_payments', 'gst_invoices', 'expenses', 'users')
  AND column_name IN ('id', 'order_value', 'cost_value', 'order_id', 'role')
ORDER BY table_name, column_name;

SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'current_user_role' AND pronamespace = 'public'::regnamespace;
