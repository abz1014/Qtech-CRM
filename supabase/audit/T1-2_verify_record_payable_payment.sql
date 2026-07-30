-- Self-contained, self-cleaning verification of record_payable_payment.
-- Creates a throwaway payable (tagged '__T1_2_VERIFY__'), calls the RPC
-- exactly as the app would, checks the result, then ROLLS BACK -- nothing
-- is ever kept regardless of outcome. Safe to run on production.
--
-- Paste this ENTIRE block into a single, empty query tab and Run once.

BEGIN;

DO $$
DECLARE
  v_payable_id uuid;
  v_admin_id   uuid;
  v_vendor_id  uuid;
BEGIN
  SELECT id INTO v_admin_id  FROM public.users   WHERE role = 'admin' LIMIT 1;
  SELECT id INTO v_vendor_id FROM public.vendors LIMIT 1;

  INSERT INTO public.payables (invoice_reference, vendor_id, amount, due_date, created_by)
  VALUES ('__T1_2_VERIFY__', v_vendor_id, 10000, CURRENT_DATE + 30, v_admin_id)
  RETURNING payable_id INTO v_payable_id;

  PERFORM public.record_payable_payment(
    v_payable_id, 10000, CURRENT_DATE::text, 'Bank Transfer', 'REF-001', 'verification test', v_admin_id
  );
END $$;

-- Found by the tag string alone -- no temp table needed.
SELECT invoice_reference, amount_paid, payment_status, payment_method, payment_date,
       (SELECT count(*) FROM public.payable_payments p
          WHERE p.payable_id = pb.payable_id) AS payment_rows,
       (SELECT reference_number FROM public.payable_payments p
          WHERE p.payable_id = pb.payable_id LIMIT 1) AS ref_number
FROM public.payables pb
WHERE invoice_reference = '__T1_2_VERIFY__';

ROLLBACK;
