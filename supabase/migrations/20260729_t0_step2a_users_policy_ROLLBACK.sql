-- ============================================================================
-- ROLLBACK for 20260729_t0_step2a_users_policy.sql
-- ============================================================================
-- Run this if login breaks or the app cannot resolve roles after stage A.
--
-- It restores the permissive `allow_all` policy on `users` ONLY. That returns
-- the table to its previous (insecure but working) state so you are not locked
-- out. `anon` remains revoked from step 1, so this does NOT reopen anonymous
-- access -- the exposure restored here is limited to authenticated users.
--
-- Tell me what failed and I will correct the policy rather than leave this in
-- place; `allow_all` on `users` means any logged-in employee can UPDATE their
-- own `role` to 'admin'.
-- ============================================================================

DROP POLICY IF EXISTS users_select_authenticated ON public.users;

CREATE POLICY allow_all
  ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Keep the helper function; it is harmless and stage B depends on it.
-- To remove it entirely:
--   DROP FUNCTION IF EXISTS public.current_user_role();

-- Verify
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';
