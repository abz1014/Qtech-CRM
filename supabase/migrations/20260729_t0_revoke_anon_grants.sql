-- ============================================================================
-- T0-2 STEP 1 — REVOKE ANONYMOUS ACCESS TO THE PUBLIC SCHEMA
-- ============================================================================
-- Ticket:  T0-2 (step 1 of 2)  |  Audit: supabase/audit/T0-1_CONFIRMED.md
-- Date:    2026-07-29
--
-- PROBLEM (confirmed live, T0-1):
--   10 core tables carry `allow_all  FOR ALL  TO public  USING (true) WITH CHECK (true)`.
--   `public` includes the `anon` role, and Query 6 confirmed `anon` additionally holds
--   table-level SELECT/INSERT/UPDATE/DELETE/TRUNCATE on EVERY table in the schema.
--   Net effect: any holder of the publishable key -- which ships in the browser
--   bundle and is therefore effectively public -- can read, modify and delete
--   customers, suppliers, RFQs and orders (incl. order_value / cost_value /
--   order_gst_amount = revenue, cost and margin), and can run
--   `UPDATE users SET role='admin'` to self-promote.
--
-- WHY REVOKING `anon` IS SAFE:
--   The application has NO unauthenticated data path.
--     * Every route is behind `ProtectedRoutes` (src/App.tsx).
--     * Login uses Supabase Auth -> the `auth` schema, NOT `public`.
--     * `AuthContext` fetches the profile only once a session exists.
--     * `CRMContext`'s load effect is gated on `authUser?.id`.
--     * Realtime subscribes after load, using the authenticated session.
--   After sign-in the session acts as `authenticated`, never `anon`.
--   Therefore `anon` requires no privilege on `public` at all.
--
-- EFFECT:
--   Collapses exposure from "anyone on the internet" to "any logged-in employee".
--   It does NOT fix the over-broad `authenticated` access -- that is step 2,
--   which replaces the permissive policies and needs per-table policy work.
--
-- REVERSIBILITY: fully reversible -- see 20260729_t0_revoke_anon_grants_ROLLBACK.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — SNAPSHOT (run FIRST, save the output as the rollback reference)
-- ----------------------------------------------------------------------------
-- Read-only. Records exactly what `anon` can reach today.
SELECT grantee, table_name,
       STRING_AGG(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY grantee, table_name
ORDER BY table_name;


-- ----------------------------------------------------------------------------
-- STEP 1 — THE CHANGE
-- ----------------------------------------------------------------------------
-- Existing objects
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Future objects created by the current role (so a new table is not born open)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- NOTE: schema USAGE is deliberately NOT revoked. It is unnecessary once no
-- table privileges remain, and leaving it keeps the change minimal and easy
-- to reason about if a rollback is needed.


-- ----------------------------------------------------------------------------
-- STEP 2 — VERIFY (expect ZERO rows)
-- ----------------------------------------------------------------------------
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
ORDER BY table_name;

-- Confirm `authenticated` is untouched (expect the full table list -- the app
-- still relies on these until step 2 tightens the policies).
SELECT COUNT(DISTINCT table_name) AS authenticated_tables
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'authenticated';
