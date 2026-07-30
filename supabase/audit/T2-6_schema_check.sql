-- ============================================================================
-- T2-6 pre-flight — read-only schema verification for the audit_log migration
-- Paste the full output back. Nothing here writes anything.
-- ============================================================================

-- (1) Confirm the tables I'm about to attach triggers to actually exist with
--     the column names/types the trigger function and migration will assume.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_payments', 'supplier_payments', 'gst_invoices', 'expenses', 'users')
  AND column_name IN ('id', 'order_value', 'cost_value', 'order_id', 'role')
ORDER BY table_name, column_name;

-- (2) Confirm current_user_role() exists and is SECURITY DEFINER (T2-6 reuses it).
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'current_user_role' AND pronamespace = 'public'::regnamespace;

-- (3) Make sure audit_log doesn't already exist under a different shape.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audit_log';

-- (4) Any existing triggers on the target tables, so I don't collide with one.
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('orders', 'order_payments', 'supplier_payments', 'gst_invoices', 'expenses')
ORDER BY event_object_table, trigger_name;
