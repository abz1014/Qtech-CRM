-- Read-only. Confirms whether profit/profit_margin (orders), status (payables),
-- and created_by (follow_up_actions) really exist live, before deciding
-- whether to update the TS types or remove the dead code referencing them.
SELECT 'orders' AS tbl, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name IN ('profit', 'profit_margin')
UNION ALL
SELECT 'payables', column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payables'
  AND column_name = 'status'
UNION ALL
SELECT 'follow_up_actions', column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'follow_up_actions'
  AND column_name = 'created_by';
