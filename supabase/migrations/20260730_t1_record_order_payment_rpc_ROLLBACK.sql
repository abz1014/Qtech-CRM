-- ROLLBACK for 20260730_t1_record_order_payment_rpc.sql
DROP FUNCTION IF EXISTS public.record_order_payment(uuid, numeric, text, text, text, text, uuid);

-- Verify: expect 0 rows
SELECT proname FROM pg_proc
WHERE proname = 'record_order_payment' AND pronamespace = 'public'::regnamespace;
