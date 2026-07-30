-- ROLLBACK for 20260730_t1_record_invoice_payment_rpc.sql
DROP FUNCTION IF EXISTS public.record_invoice_payment(uuid, numeric, date, text, text, uuid);

-- Verify: expect 0 rows
SELECT proname FROM pg_proc
WHERE proname = 'record_invoice_payment' AND pronamespace = 'public'::regnamespace;
