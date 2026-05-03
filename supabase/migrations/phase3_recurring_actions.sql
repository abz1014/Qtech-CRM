-- Phase 3: Add recurrence support to follow_up_actions
-- Run this in Supabase SQL Editor before deploying Phase 3

ALTER TABLE follow_up_actions
  ADD COLUMN IF NOT EXISTS recurrence_days INTEGER DEFAULT NULL;

-- Optional: index for querying completed recurring actions
CREATE INDEX IF NOT EXISTS idx_followup_recurrence
  ON follow_up_actions (recurrence_days)
  WHERE recurrence_days IS NOT NULL;
