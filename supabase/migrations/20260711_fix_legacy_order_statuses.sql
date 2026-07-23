-- ============================================================================
-- 2026-07-11 · Fix legacy order statuses (data irregularity)
-- The Oct 2024–Jan 2025 historical import (seed_historical_data.sql) inserted
-- orders with status 'completed' — a value that is NOT part of the app's order
-- lifecycle (po_received → procurement → in_transit → delivered →
-- payment_received). Because the orders table had no CHECK constraint, the DB
-- accepted it. Those orders (delivered + paid, per their notes) therefore
-- showed as perpetually payment-pending in Receivables / Payables / Operations.
--
-- This migration maps the legacy statuses to the correct current ones and adds
-- a CHECK constraint so an invalid status can never be stored again.
-- Safe to run repeatedly.
-- ============================================================================

-- 1) 'completed' were fully settled deals → payment_received
UPDATE orders SET status = 'payment_received' WHERE status = 'completed';

-- 2) Any other out-of-lifecycle value (e.g. the legacy 'quotation' default) →
--    reset to the start of the lifecycle so it re-enters the workflow cleanly.
UPDATE orders SET status = 'po_received'
WHERE status NOT IN ('po_received','procurement','in_transit','delivered','payment_received');

-- 3) Fix the column default (was the legacy 'quotation') and lock the domain.
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'po_received';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('po_received','procurement','in_transit','delivered','payment_received'));

-- 4) Report what changed (paste output into the deploy log if you like)
-- SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY status;
