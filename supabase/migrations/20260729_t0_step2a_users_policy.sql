-- ============================================================================
-- T0-2 STEP 2A — FIX `users` RLS (PREREQUISITE FOR EVERYTHING ELSE)
-- ============================================================================
-- Ticket: T0-2 (stage A of D)   |   Audit: supabase/audit/T0-1_CONFIRMED.md
-- Date:   2026-07-29
--
-- ⚠️  RUN THIS ALONE. VERIFY LOGIN. DO NOT PROCEED TO STAGE B UNTIL IT WORKS.
--
-- WHY THIS MUST BE FIRST
-- ----------------------
-- The live `users` table currently carries policies of the form:
--     USING ( (SELECT role FROM users WHERE id = auth.uid()) = 'admin' )
-- i.e. a policy ON `users` that SELECTs FROM `users`. Evaluating it re-triggers
-- itself, and Postgres aborts with:
--     42P17: infinite recursion detected in policy for relation "users"
--
-- Today `allow_all (USING true)` masks this: permissive policies are OR'd and
-- the `true` literal short-circuits, so the recursive branch is never reached.
-- The moment `allow_all` is dropped, the recursion becomes live and:
--   * AuthContext.tsx:68 (`.from('users').select('*').eq('id', userId)`) fails
--     -> no role can be resolved -> EVERY user is effectively logged out.
--   * Worse, EVERY OTHER TABLE's policy runs that same `SELECT role FROM users`
--     subquery. If reading `users` errors or returns nothing, every role check
--     in the database silently evaluates FALSE and the whole app goes blank.
--
-- THE FIX
-- -------
-- 1. A SECURITY DEFINER helper that reads the caller's role WITHOUT invoking
--    RLS on `users` -- this is the Supabase-recommended way to break the cycle,
--    and it is also faster (STABLE, evaluated once per statement).
-- 2. A single, simple, NON-recursive SELECT policy on `users`.
--
-- ACCESS DECISION (from the call-site trace):
--   SELECT : authenticated  -- CRMContext.tsx:261 loads the roster ungated;
--                              userMap (CRMContext.tsx:671) resolves assignee
--                              and owner names across Actions / RFQs / Orders.
--                              AuthContext.tsx:68 needs it on every login,
--                              onAuthStateChange, and window focus.
--   INSERT/UPDATE/DELETE : NONE from the client. User creation goes through
--                          supabase/functions/create-user/index.ts, which uses
--                          the service_role key and bypasses RLS entirely.
--                          There is no role-change or profile-edit UI.
--
-- Safe to expose the roster to staff: T0-1 confirmed the plaintext `password`
-- column no longer exists (plaintext_password_cols = 0). Remaining columns are
-- name / email / role -- internal directory data.
--
-- REVERSIBILITY: see 20260729_t0_step2a_users_policy_ROLLBACK.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — SNAPSHOT (read-only; save the output before proceeding)
-- ----------------------------------------------------------------------------
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY cmd, policyname;


-- ----------------------------------------------------------------------------
-- STEP 1 — Non-recursive role helper
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: runs as the function owner, so the read of `users` inside
-- is NOT subject to users' RLS -> no recursion.
-- STABLE: Postgres may evaluate it once per statement instead of once per row.
-- Fixed search_path: prevents search_path hijacking of a SECURITY DEFINER fn.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL   ON FUNCTION public.current_user_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;


-- ----------------------------------------------------------------------------
-- STEP 2 — Replace every policy on `users` with one known-good policy
-- ----------------------------------------------------------------------------
-- Drop-all-then-create, because the live policy names drifted from the repo
-- and we want a deterministic end state rather than a guess.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', p.policyname);
  END LOOP;
END $$;

-- The only client-side access `users` needs.
CREATE POLICY users_select_authenticated
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy: writes happen only via the create-user edge
-- function under service_role, which bypasses RLS. RLS-on + no policy for those
-- commands = fail closed. This deliberately removes the ability of a logged-in
-- user to change their own `role` column.


-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY
-- ----------------------------------------------------------------------------
-- Expect exactly ONE row: users_select_authenticated | SELECT | {authenticated}
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';

-- Expect the helper to exist and be SECURITY DEFINER (prosecdef = true)
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'current_user_role' AND pronamespace = 'public'::regnamespace;


-- ============================================================================
-- ⛔ STOP HERE. Log in to the app and confirm:
--      1. Login succeeds (admin)
--      2. The dashboard loads (13 clients / 34 orders / Rs 11,510,414)
--      3. Assignee / owner names render on Actions and RFQs (userMap works)
--    Only then run stage B.
-- ============================================================================
