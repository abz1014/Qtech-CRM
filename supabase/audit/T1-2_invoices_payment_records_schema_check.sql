-- Read-only. Confirms live column types on invoices + payment_records before
-- writing the T1-2 part-2 RPC (record_invoice_payment).
SELECT 'invoices' AS tbl, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoices'
UNION ALL
SELECT 'payment_records', column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payment_records'
ORDER BY tbl, column_name;
