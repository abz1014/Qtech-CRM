-- Self-contained, self-cleaning verification of record_invoice_payment.
-- Creates a throwaway invoice (tagged '__T1_2_VERIFY__'), calls the RPC
-- exactly as the app would, checks the result, then ROLLS BACK -- nothing
-- is ever kept regardless of outcome. Safe to run on production.
--
-- Paste this ENTIRE block into a single, empty query tab and Run once.

BEGIN;

DO $$
DECLARE
  v_invoice_id uuid;
  v_admin_id   uuid;
  v_client_id  uuid;
BEGIN
  SELECT id INTO v_admin_id  FROM public.users   WHERE role = 'admin' LIMIT 1;
  SELECT id INTO v_client_id FROM public.clients LIMIT 1;

  INSERT INTO public.invoices (invoice_number, client_id, invoice_amount, issued_date, due_date, created_by)
  VALUES ('__T1_2_VERIFY__', v_client_id, 10000, CURRENT_DATE, CURRENT_DATE + 30, v_admin_id)
  RETURNING invoice_id INTO v_invoice_id;

  PERFORM public.record_invoice_payment(
    v_invoice_id, 10000, CURRENT_DATE, 'Bank Transfer', 'verification test', v_admin_id
  );
END $$;

-- Found by the tag string alone -- no temp table needed.
SELECT invoice_number, amount_paid, payment_status, payment_method,
       (SELECT count(*) FROM public.payment_records p
          WHERE p.invoice_id = i.invoice_id) AS payment_rows
FROM public.invoices i
WHERE invoice_number = '__T1_2_VERIFY__';

ROLLBACK;
