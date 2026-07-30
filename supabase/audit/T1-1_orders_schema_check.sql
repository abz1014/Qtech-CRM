-- Read-only. Confirms the exact live column types on `orders` for columns
-- that exist in production but were never captured in any committed
-- migration (customer_po_number, customer_po_date, payment_terms_days,
-- delivery_date, payment_due_date) — needed to write a correct RPC signature
-- for T1-1 rather than guess.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;
