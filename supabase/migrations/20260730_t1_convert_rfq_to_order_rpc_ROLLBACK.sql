-- ============================================================================
-- ROLLBACK for 20260730_t1_convert_rfq_to_order_rpc.sql
-- ============================================================================
-- Only needed if the RPC itself is broken and you need to revert the DB side
-- while CRMContext.tsx is reverted separately (git revert the paired app
-- commit) back to its two-call implementation.
-- ============================================================================

DROP FUNCTION IF EXISTS public.convert_rfq_to_order(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, text, text, text, integer, text, text
);

-- Verify: expect 0 rows
SELECT proname FROM pg_proc
WHERE proname = 'convert_rfq_to_order' AND pronamespace = 'public'::regnamespace;
