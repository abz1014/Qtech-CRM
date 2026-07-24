-- ============================================================================
-- 2026-07-24 · Operations: dismiss an overdue payment from the tab
-- The Operations page keeps ALL overdue payments visible (no age cutoff), but an
-- admin can remove a specific one from that list once it's handled. This flag
-- hides it from Operations without deleting the order or its data.
-- Idempotent — safe to run repeatedly.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_dismissed BOOLEAN NOT NULL DEFAULT false;
