-- ============================================================================
-- 2026-07-24 · One open follow-up per entity + type
-- The app dedups before auto-creating a follow-up, but a check-then-insert race
-- (two tabs loading at once) could still slip a duplicate through — cluttering
-- the Actions page and inflating the "overdue" count. Enforce it at the DB.
--
-- 1) Remove existing duplicate PENDING follow-ups, keeping one per
--    (entity_id, entity_type, action_type).
-- 2) Add a partial unique index so a second open one can never be inserted.
--    (Completed/other-status rows are unaffected, so a resolved item can raise a
--     fresh follow-up later.) Idempotent.
-- ============================================================================

DELETE FROM follow_up_actions a
USING follow_up_actions b
WHERE a.status = 'pending' AND b.status = 'pending'
  AND a.entity_id  = b.entity_id
  AND a.entity_type = b.entity_type
  AND a.action_type = b.action_type
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_followup_open_per_entity
  ON follow_up_actions(entity_id, entity_type, action_type)
  WHERE status = 'pending';
