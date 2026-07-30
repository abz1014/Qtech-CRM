-- ============================================================================
-- T2-6 — Audit logging on financial + GST mutations
-- ============================================================================
-- Ticket: T2-6  |  Date: 2026-07-30
--
-- SCOPE (deliberately narrow, per the backlog: "money and tax only, not
-- every CRUD action"):
--   orders            -- ONLY when order_value or cost_value changes (not
--                         every edit -- status/notes/dates aren't money)
--   order_payments    -- customer payments (insert-only in practice)
--   supplier_payments -- vendor payments (insert-only in practice)
--   gst_invoices      -- full row -- tax filing data changes across its
--                         whole lifecycle (FBR status, PSID, deposit, etc.)
--   expenses          -- money out
--
-- DEVIATION FROM THE BACKLOG'S LITERAL TEXT: it names `invoices`, `payments`,
-- `payables` instead of gst_invoices/order_payments/supplier_payments. Those
-- three are dead tables -- no page in the live app reads or writes them
-- (confirmed via grep, same finding T2-5 made independently). Auditing them
-- would only ever produce empty audit trails for mutations that never
-- happen. Confirmed with the user before building (see T2-5's precedent).
--
-- PRE-FLIGHT (live-verified, not guessed):
--   * public.audit_log already exists (id uuid PK, table_name varchar,
--     record_id uuid, action varchar, changed_by uuid, changed_at timestamp
--     default now(), old_value jsonb, new_value jsonb) -- an empty scaffold,
--     0 rows, RLS enabled with ZERO policies (fail-closed), no triggers
--     anywhere in the schema. This migration is additive to that scaffold,
--     not a fresh CREATE TABLE.
--   * expenses' primary key is `expense_id`, not `id` -- every other target
--     table uses `id`. The trigger function takes the PK column name as a
--     trigger argument so one function serves both shapes.
--   * public.current_user_role() exists, SECURITY DEFINER, STABLE -- reused
--     for the admin-only read policy (same helper T0-2 introduced).
--
-- APPEND-ONLY BY DESIGN: no UPDATE/DELETE policy is created for audit_log,
-- and no role is granted UPDATE/DELETE on it. The only writer is the
-- SECURITY DEFINER trigger function, which runs as the table owner and so
-- bypasses RLS for its own INSERT -- API clients (including admins) cannot
-- write to it directly, only read.
--
-- ACTOR ATTRIBUTION: auth.uid() inside a SECURITY DEFINER function still
-- reads the calling session's JWT claim, not the function owner's identity
-- -- it correctly captures who performed the mutation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 — RLS: admin-only read, no write policy for anyone
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'audit_log_select') THEN
    CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
      USING (public.current_user_role() = 'admin');
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);

-- Realtime, so the admin viewer updates live as new audit rows land.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'audit_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2 — Generic trigger function
-- ----------------------------------------------------------------------------
-- TG_ARGV[0] is the PK column name ('id' for most tables, 'expense_id' for
-- expenses) -- read out of to_jsonb(NEW/OLD) since it varies per table.
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk_col    text := TG_ARGV[0];
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := (to_jsonb(OLD) ->> v_pk_col)::uuid;
  ELSE
    v_record_id := (to_jsonb(NEW) ->> v_pk_col)::uuid;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$;

REVOKE ALL ON FUNCTION public.audit_trigger_fn() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- STEP 3 — Attach triggers (idempotent: drop-then-create)
-- ----------------------------------------------------------------------------

-- orders: only when the money fields actually change. INSERT/DELETE always
-- fire (a whole order appearing/disappearing is inherently a money event);
-- UPDATE only fires when order_value or cost_value is part of the change.
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
  AFTER INSERT OR DELETE OR UPDATE OF order_value, cost_value ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_order_payments ON public.order_payments;
CREATE TRIGGER audit_order_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_supplier_payments ON public.supplier_payments;
CREATE TRIGGER audit_supplier_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_gst_invoices ON public.gst_invoices;
CREATE TRIGGER audit_gst_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.gst_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn('expense_id');

-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
-- (a) All 5 triggers attached.
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table;

-- (b) audit_log has exactly one policy (SELECT, admin-only) and no write policy.
SELECT policyname, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_log';

-- (c) Smoke test (run as admin, then check the row landed, then delete the
--     test order to clean up -- the DELETE itself will also log correctly):
--     INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes)
--     VALUES (NULL, (SELECT id FROM vendors LIMIT 1), auth.uid(), 'Test', 1000, 500, 'confirmed', 'T2-6 smoke test')
--     RETURNING id;
--     SELECT * FROM audit_log WHERE table_name = 'orders' ORDER BY changed_at DESC LIMIT 1;
-- ============================================================================
