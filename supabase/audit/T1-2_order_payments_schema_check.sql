-- Read-only. Confirms the live column types on order_payments before writing
-- the T1-2 RPC — orders drifted badly from its migrations (see T1-1), so
-- checking rather than trusting 20260711_finance_rebuild.sql at face value.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_payments'
ORDER BY ordinal_position;
