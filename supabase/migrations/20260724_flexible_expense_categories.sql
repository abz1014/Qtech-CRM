-- ============================================================================
-- 2026-07-24 · Flexible expense categories (custom groups)
-- The expense category was locked to a fixed 9-value CHECK. Admins now want to
-- add their own expense groups, so drop the CHECK on both expenses and
-- recurring_expenses — any non-empty label is allowed. The default stays 'Misc',
-- and the UI still suggests the built-in groups. Idempotent.
-- ============================================================================

ALTER TABLE expenses           DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_category_check;
