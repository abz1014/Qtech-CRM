-- Read-only. orders.client_id and rfqs.client_id are ON DELETE SET NULL,
-- but the TS types declare client_id: string (non-nullable). SET NULL only
-- works if the column actually allows NULL -- confirming before relying on
-- it in app code.
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'orders' AND column_name = 'client_id')
    OR (table_name = 'rfqs' AND column_name = 'client_id'));
