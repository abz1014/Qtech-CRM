-- ============================================================================
-- T1-2 (part 3/3) — TRANSACTIONAL RPC: record_payable_payment
-- ============================================================================
-- Ticket: T1-2  |  Date: 2026-07-30
--
-- Same class of fix as parts 1/2. recordPayablePayment (src/contexts/CRMContext.tsx)
-- computed the new amount_paid from LOCAL React state (payables.find(...)), then
-- did a separate UPDATE on payables and a separate, unchecked INSERT into
-- payable_payments -- three problems: (a) lost-update race if two admins record
-- payments on the same payable concurrently, since the "current total" was read
-- from stale client state, not the DB; (b) partial-failure exposure across the
-- two writes; (c) the payable_payments insert had zero error handling
-- (fire-and-forget).
--
-- Concurrency fix: lock the payable row (FOR UPDATE) and read amount_paid from
-- THAT locked row, not from client state, before computing the new total.
-- Two concurrent payments on the SAME payable serialize here; different
-- payables never contend.
--
-- TYPES verified live (information_schema.columns), not assumed:
--   payables.payable_id/amount/amount_paid/payment_status/payment_date(date)/payment_method
--   payable_payments.payable_id/amount/payment_date(text -- NOT date, unlike
--   payables.payment_date; confirmed live, not assumed)/payment_method/
--   reference_number/notes/recorded_by
--   NOTE: payable_payments DOES have reference_number/notes columns -- the app
--   code writing them was correct; the TS type CreatePayablePaymentInput was
--   simply missing those two fields (fixed alongside this RPC).
--
-- BEHAVIOR PRESERVED EXACTLY:
--   - payment_status becomes 'Paid' if paisa-rounded total >= paisa-rounded
--     payable amount, else 'Partial' -- matches the existing JS exactly.
--   - Overpayment guard preserved: throws if the new total would exceed the
--     payable amount (paisa-rounded), same as the existing JS check.
--   - payables.payment_date/payment_method overwritten to the latest payment's
--     values, matching the existing update({...}) call exactly.
--
-- REACHABILITY: recordPayablePayment currently has zero UI callers in this
-- build (no PayablesTab/PayablePaymentModal component exists) -- verified via
-- grep. Fixed for correctness/consistency with parts 1-2 regardless; verified
-- via SQL only (no end-to-end browser path exists to exercise it).
--
-- SECURITY: SECURITY INVOKER (default). Both tables remain admin-only via
-- existing RLS (payables_*, payable_payments_*) -- unchanged by this function.
--
-- REVERSIBILITY: 20260730_t1_record_payable_payment_rpc_ROLLBACK.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_payable_payment(
  p_payable_id       uuid,
  p_amount           numeric,
  p_payment_date     text,
  p_payment_method   text,
  p_reference_number text,
  p_notes            text,
  p_recorded_by      uuid
)
RETURNS public.payables
LANGUAGE plpgsql
AS $$
DECLARE
  v_payable         public.payables;
  v_new_amount_paid numeric;
  v_status          text;
BEGIN
  SELECT * INTO v_payable
  FROM public.payables WHERE payable_id = p_payable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_payable_payment: payable % not found', p_payable_id;
  END IF;

  v_new_amount_paid := COALESCE(v_payable.amount_paid, 0) + p_amount;

  IF ROUND(v_new_amount_paid * 100) > ROUND(v_payable.amount * 100) THEN
    RAISE EXCEPTION 'record_payable_payment: payment amount exceeds payable amount';
  END IF;

  INSERT INTO public.payable_payments (
    payable_id, amount, payment_date, payment_method, reference_number, notes, recorded_by
  ) VALUES (
    p_payable_id, p_amount, p_payment_date, p_payment_method, p_reference_number, p_notes, p_recorded_by
  );

  v_status := CASE WHEN ROUND(v_new_amount_paid * 100) >= ROUND(v_payable.amount * 100)
                    THEN 'Paid' ELSE 'Partial' END;

  UPDATE public.payables
  SET amount_paid    = v_new_amount_paid,
      payment_status = v_status,
      payment_date   = p_payment_date::date,
      payment_method = p_payment_method
  WHERE payable_id = p_payable_id
  RETURNING * INTO v_payable;

  RETURN v_payable;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payable_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payable_payment TO authenticated;


-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'record_payable_payment';
-- Expect: authenticated / EXECUTE (plus service_role, postgres); no anon
