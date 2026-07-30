-- ============================================================================
-- T1-2 (part 1/3) — TRANSACTIONAL RPC: record_order_payment
-- ============================================================================
-- Ticket: T1-2  |  Date: 2026-07-30
--
-- PROBLEM
--   addOrderPayment (src/contexts/CRMContext.tsx) did three separate network
--   calls: INSERT the payment, SELECT-and-sum all payments for the order,
--   then conditionally UPDATE the order to 'payment_received'. A dropped
--   connection between the insert and the status update leaves the payment
--   recorded but a fully-paid 'delivered' order permanently stuck — it never
--   auto-advances, with nothing in the UI explaining why.
--
--   Concurrency: two admins recording payments on the same order nearly
--   simultaneously could both read "not yet fully paid" before either's
--   insert was visible to the other, and neither call would flip the status
--   even though the order became fully paid the moment both payments landed.
--
-- FIX
--   One Postgres function does insert + recompute + conditional advance
--   atomically. Concurrency is solved by locking the ORDER row (SELECT ...
--   FOR UPDATE) before inserting the payment: a second concurrent call for
--   the SAME order blocks until the first transaction commits, so by the
--   time it sums payments, every earlier-committed payment is guaranteed
--   visible. Payments on DIFFERENT orders never contend with each other —
--   only same-order calls serialize, which is exactly the scope of the race.
--
-- TYPES: order_payments matches its migration exactly (verified live, unlike
--   orders — see T1-1's schema-drift finding). orders.status/order_value
--   confirmed live as character varying / numeric (T1-1 audit).
--
-- BEHAVIOR PRESERVED EXACTLY: only advances status when the order's CURRENT
--   status is literally 'delivered' (matches the existing JS check), and
--   only when total paid >= order_value compared in whole paisa (matches
--   Math.round(totalPaid*100) >= Math.round(order.order_value*100)).
--
-- SECURITY: SECURITY INVOKER (default). order_payments and orders both
--   remain admin-only per existing RLS — this function does not change who
--   can call it, only how atomically the work happens once they do.
--
-- REVERSIBILITY: 20260730_t1_record_order_payment_rpc_ROLLBACK.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id       uuid,
  p_amount         numeric,
  p_payment_date   text,
  p_payment_method text,
  p_reference      text,
  p_notes          text,
  p_recorded_by    uuid
)
RETURNS public.order_payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment      public.order_payments;
  v_order_status text;
  v_order_value  numeric;
  v_total        numeric;
BEGIN
  -- Lock the order row FIRST (before inserting the payment) so a concurrent
  -- call for the same order queues here rather than racing past this check.
  SELECT status, order_value INTO v_order_status, v_order_value
  FROM public.orders WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_order_payment: order % not found', p_order_id;
  END IF;

  INSERT INTO public.order_payments (
    order_id, amount, payment_date, payment_method, reference, notes, recorded_by
  ) VALUES (
    p_order_id, p_amount, p_payment_date, p_payment_method, p_reference, p_notes, p_recorded_by
  )
  RETURNING * INTO v_payment;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.order_payments WHERE order_id = p_order_id;

  IF v_order_status = 'delivered' AND ROUND(v_total * 100) >= ROUND(v_order_value * 100) THEN
    UPDATE public.orders SET status = 'payment_received' WHERE id = p_order_id;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_payment TO authenticated;


-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'record_order_payment';
-- Expect: authenticated / EXECUTE (plus service_role, postgres — normal); no anon
