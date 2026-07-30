-- Read-only. Lists every foreign key referencing the parent tables the app
-- currently cascade-deletes by hand (clients, rfqs, orders, vendors,
-- prospects), plus each FK's ON DELETE behavior (NO ACTION/RESTRICT/CASCADE/
-- SET NULL). Tells us what the DB actually enforces today, before deciding
-- what ON DELETE behavior each relationship should have.
SELECT
  tc.table_name       AS child_table,
  kcu.column_name     AS child_column,
  ccu.table_name      AS parent_table,
  ccu.column_name     AS parent_column,
  rc.delete_rule       AS on_delete,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name IN ('clients', 'rfqs', 'orders', 'vendors', 'prospects')
ORDER BY parent_table, child_table;
