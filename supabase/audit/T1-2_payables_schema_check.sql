-- Read-only. Confirms live column types on payables + payable_payments before
-- writing the T1-2 part-3 RPC (record_payable_payment).
SELECT 'payables' AS tbl, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payables'
UNION ALL
SELECT 'payable_payments', column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payable_payments'
ORDER BY tbl, column_name;
