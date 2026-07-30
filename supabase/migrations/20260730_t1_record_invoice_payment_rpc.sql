-- ============================================================================
-- T1-2 (part 2/3) — TRANSACTIONAL RPC: record_invoice_payment
-- ============================================================================
-- Ticket: T1-2  |  Date: 2026-07-30
--
-- Same class of fix as part 1 (record_order_payment). recordPayment
-- (src/contexts/CRMContext.tsx) did an INSERT into payment_records, a
-- SELECT-and-sum over payment_records for the invoice, then a separate
-- updateInvoice() call setting amount_paid/payment_status/payment_method --
-- three round trips, with the same partial-failure and same-invoice-race
-- exposure as the order-payment flow.
--
-- Concurrency fix: lock the invoice row (FOR UPDATE) before inserting the
-- payment, so two concurrent payments on the SAME invoice serialize here;
-- payments on different invoices never contend.
--
-- TYPES verified live (information_schema.columns), not assumed:
--   invoices.invoice_id/amount_paid/invoice_amount/payment_status/payment_method
--   payment_records.payment_id/invoice_id/amount/payment_date/payment_method/notes/recorded_by
--   NOTE: payment_records.payment_date and invoices.issued_date/due_date are
--   native `date`, unlike most date-like columns elsewhere in this app
--   (which are `text`) -- confirmed, not assumed, to avoid a repeat of the
--   `orders` schema-drift surprise from T1-1.
--
-- BEHAVIOR PRESERVED EXACTLY:
--   - payment_status becomes 'Paid' if paisa-rounded total >= paisa-rounded
--     invoice_amount, else 'Partial' -- the existing JS never assigns
--     'Pending' or 'Overdue' from this code path, and neither does this RPC.
--   - invoices.payment_method is overwritten to the LATEST payment's method
--     (matches the existing updateInvoice(...) call exactly -- this is a
--     pre-existing quirk, not something this ticket changes).
--
-- SECURITY: SECURITY INVOKER (default). Both tables remain admin-only via
-- existing RLS (invoices_*, payment_records_*) -- unchanged by this function.
--
-- REVERSIBILITY: 20260730_t1_record_invoice_payment_rpc_ROLLBACK.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id     uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text,
  p_notes          text,
  p_recorded_by    uuid
)
RETURNS public.payment_records
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment        public.payment_records;
  v_invoice_amount numeric;
  v_total          numeric;
  v_status         text;
BEGIN
  SELECT invoice_amount INTO v_invoice_amount
  FROM public.invoices WHERE invoice_id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_invoice_payment: invoice % not found', p_invoice_id;
  END IF;

  INSERT INTO public.payment_records (
    invoice_id, amount, payment_date, payment_method, notes, recorded_by
  ) VALUES (
    p_invoice_id, p_amount, p_payment_date, p_payment_method, p_notes, p_recorded_by
  )
  RETURNING * INTO v_payment;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.payment_records WHERE invoice_id = p_invoice_id;

  v_status := CASE WHEN ROUND(v_total * 100) >= ROUND(v_invoice_amount * 100)
                    THEN 'Paid' ELSE 'Partial' END;

  UPDATE public.invoices
  SET amount_paid = v_total, payment_status = v_status, payment_method = p_payment_method
  WHERE invoice_id = p_invoice_id;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invoice_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment TO authenticated;


-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'record_invoice_payment';
-- Expect: authenticated / EXECUTE (plus service_role, postgres); no anon
