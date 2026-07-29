-- ============================================================================
-- ROLLBACK for 20260729_t0_revoke_anon_grants.sql
-- ============================================================================
-- Run this ONLY if revoking `anon` broke a user-visible workflow.
--
-- ⚠️  WARNING: this restores the ANONYMOUS FULL-ACCESS exposure documented in
--     supabase/audit/T0-1_CONFIRMED.md. It should be treated as a temporary
--     emergency measure while the breakage is diagnosed -- never a resting state.
--
-- If you need this, tell me WHAT broke and for WHICH role. Almost certainly the
-- correct fix is a narrow grant on one table, not restoring blanket anon access.
-- ============================================================================

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

-- Verify restoration (expect the full table list to return)
SELECT grantee, table_name,
       STRING_AGG(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY grantee, table_name
ORDER BY table_name;
