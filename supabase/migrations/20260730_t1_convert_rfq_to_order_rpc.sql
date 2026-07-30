-- ============================================================================
-- T1-1 — TRANSACTIONAL RPC: convert_rfq_to_order
-- ============================================================================
-- Ticket: T1-1  |  Date: 2026-07-30
--
-- PROBLEM
--   src/contexts/CRMContext.tsx's convertRFQToOrder did two separate network
--   calls: INSERT into orders, then UPDATE rfqs SET status='converted'. If the
--   second call failed after the first succeeded (dropped connection, timeout
--   — not far-fetched), the result was a REAL order left in the database
--   whose originating RFQ still showed as 'quoted'. Since the "Create Order"
--   button reappears whenever the RFQ has any supplier quote, a user could
--   then create a SECOND order from the same RFQ with no warning the first
--   one already existed.
--
-- FIX
--   Both writes now happen inside one Postgres function body, which executes
--   as a single implicit transaction — if either statement fails, both are
--   rolled back together. No partial state is possible.
--
-- TYPES — confirmed against the LIVE database, not schema.sql
--   The live `orders` table has drifted significantly from every committed
--   migration: confirmed_date is actually TIMESTAMPTZ (schema.sql says TEXT),
--   product_type/order_value/status are nullable with no NOT NULL (schema.sql
--   says NOT NULL), and columns material_cost/engineering_cost/logistics_cost/
--   overhead_cost/total_cost/profit/profit_margin/updated_at exist with no
--   migration ever having added them. This function's parameter types match
--   the LIVE schema (verified via information_schema.columns), not the
--   repo's schema.sql. See the chat/audit notes for the broader schema-drift
--   finding this surfaced — worth a dedicated reconciliation pass, out of
--   scope for this ticket.
--
-- BEHAVIOR PRESERVED EXACTLY (deliberately, not "fixed") —
--   confirmed_date is set to NULL unconditionally, matching the current JS
--   implementation, which silently overrides whatever the caller passes in
--   (RFQDetailPage.tsx actually sends businessToday(), which is discarded).
--   That mismatch is a separate, pre-existing bug this ticket does not touch.
--
-- SECURITY: SECURITY INVOKER (the default — no keyword needed), so this runs
--   with the CALLING user's own privileges. RLS is enforced exactly as
--   before: the caller must still satisfy orders_insert AND rfqs_update
--   (both admin+sales per T0-2 stage B) for this to succeed. This function
--   does not widen who can do this by one inch.
--
-- The auto follow-up ("pay supplier to initiate procurement") stays a
-- separate, best-effort client-side call after this RPC succeeds, unchanged
-- — it's a business reminder, not core transactional data, matching how
-- every other auto-follow-up in this app is already handled.
--
-- REVERSIBILITY: 20260730_t1_convert_rfq_to_order_rpc_ROLLBACK.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_rfq_to_order(
  p_rfq_id             uuid,
  p_client_id          uuid,
  p_vendor_id          uuid,
  p_sales_person_id    uuid,
  p_product_type       text,
  p_order_value        numeric,
  p_cost_value         numeric,
  p_status             text,
  p_notes              text,
  p_customer_po_number text,
  p_customer_po_date   text,
  p_payment_terms_days integer,
  p_delivery_date      text,
  p_payment_due_date   text
)
RETURNS public.orders
LANGUAGE plpgsql
AS $$
DECLARE
  v_order public.orders;
BEGIN
  INSERT INTO public.orders (
    rfq_id, client_id, vendor_id, sales_person_id, product_type, order_value,
    cost_value, status, notes, confirmed_date, customer_po_number,
    customer_po_date, payment_terms_days, delivery_date, payment_due_date
  ) VALUES (
    p_rfq_id, p_client_id, p_vendor_id, p_sales_person_id, p_product_type, p_order_value,
    p_cost_value, p_status, p_notes, NULL, p_customer_po_number,
    p_customer_po_date, p_payment_terms_days, p_delivery_date, p_payment_due_date
  )
  RETURNING * INTO v_order;

  UPDATE public.rfqs
  SET status = 'converted', converted_order_id = v_order.id
  WHERE id = p_rfq_id;

  -- If the RFQ row didn't exist or the UPDATE was denied by RLS, fail loudly
  -- rather than silently leaving an order with no matching converted RFQ.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convert_rfq_to_order: RFQ % not found or update denied', p_rfq_id;
  END IF;

  RETURN v_order;
END;
$$;

-- Least privilege: Postgres grants EXECUTE on new functions to PUBLIC by
-- default (unlike tables, which have no such default) — revoke that and
-- grant only to authenticated, matching the T0-2 posture.
REVOKE ALL ON FUNCTION public.convert_rfq_to_order FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_rfq_to_order TO authenticated;


-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
SELECT proname, prosecdef AS is_security_definer, provolatile
FROM pg_proc
WHERE proname = 'convert_rfq_to_order' AND pronamespace = 'public'::regnamespace;
-- Expect: is_security_definer = false (SECURITY INVOKER, the default)

SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'convert_rfq_to_order';
-- Expect: exactly one row, authenticated / EXECUTE
