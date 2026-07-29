-- ============================================================================
-- T0-1 — LIVE RLS STATE AUDIT
-- ============================================================================
-- 100% READ-ONLY. This script contains no DDL, no DML, no policy changes.
-- It only SELECTs from Postgres system catalogs. Safe to run on production.
--
-- HOW TO RUN: paste into Supabase Dashboard -> SQL Editor -> Run.
--             Run each query separately and send me the output.
--
-- WHY: the repo says one thing and the docs say another. docs/RLS_POLICIES_
-- EXPLAINED.md still reads "Current Status: DISABLED", while
-- migrations/enable_rls_security_policies.sql defines a full role-based policy
-- set. Postgres RLS is permissive-OR: if the original `allow_all (USING true)`
-- policies from schema.sql are still live, they OVERRIDE every role-based
-- policy beneath them and the database is effectively open to any holder of
-- the publishable key. We must know which is true before changing anything.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- QUERY 1 — Is RLS actually enabled, per table? (the single most important one)
-- ----------------------------------------------------------------------------
-- rls_enabled = false  ->  EXPOSED: policies are irrelevant, table is readable
-- rls_forced           ->  applies even to the table owner
SELECT
  c.relname                                   AS table_name,
  c.relrowsecurity                            AS rls_enabled,
  c.relforcerowsecurity                       AS rls_forced,
  COALESCE(p.policy_count, 0)                 AS policy_count,
  CASE
    WHEN NOT c.relrowsecurity                 THEN '*** EXPOSED - RLS OFF ***'
    WHEN COALESCE(p.policy_count, 0) = 0      THEN '*** LOCKED - RLS on, no policies ***'
    ELSE 'rls on'
  END                                         AS flag
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;


-- ----------------------------------------------------------------------------
-- QUERY 2 — Permissive "allow everything" policies (the nullifiers)
-- ----------------------------------------------------------------------------
-- Any row returned here is a policy that grants access unconditionally.
-- These are what schema.sql created. If they are still present, the
-- role-based policies added later are decorative.
SELECT
  tablename,
  policyname,
  cmd                                         AS operation,
  roles,
  qual                                        AS using_expression,
  with_check,
  '*** PERMISSIVE - NULLIFIES ROLE POLICIES ***' AS flag
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
  AND (
        qual IS NULL                          -- no USING restriction at all
     OR btrim(qual) IN ('true', '(true)')
     OR policyname ILIKE '%allow_all%'
     OR policyname ILIKE '%allow_auth%'
  )
ORDER BY tablename, policyname;


-- ----------------------------------------------------------------------------
-- QUERY 3 — Full policy inventory (what is actually enforced right now)
-- ----------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd            AS operation,
  permissive,
  roles,
  qual           AS using_expression,
  with_check     AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- QUERY 4 — Coverage gaps: which operations have NO policy?
-- ----------------------------------------------------------------------------
-- With RLS enabled, an operation with no policy is DENIED (fail-closed = good).
-- This tells us where the app relies on a policy existing, and where deletes
-- would silently fail. Cross-check against T0-2 before dropping anything.
SELECT
  c.relname AS table_name,
  BOOL_OR(p.cmd IN ('SELECT','ALL')) AS has_select,
  BOOL_OR(p.cmd IN ('INSERT','ALL')) AS has_insert,
  BOOL_OR(p.cmd IN ('UPDATE','ALL')) AS has_update,
  BOOL_OR(p.cmd IN ('DELETE','ALL')) AS has_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
       ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
GROUP BY c.relname
ORDER BY c.relname;


-- ----------------------------------------------------------------------------
-- QUERY 5 — Does the legacy plaintext password column still exist? (ticket T0-4)
-- ----------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  '*** PLAINTEXT CREDENTIAL COLUMN ***' AS flag
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ILIKE '%password%';


-- ----------------------------------------------------------------------------
-- QUERY 6 — Anon/authenticated GRANTs (the layer beneath RLS)
-- ----------------------------------------------------------------------------
-- RLS only filters rows on tables the role can reach at all. If `anon` has no
-- GRANT, that is a second line of defence. If anon has SELECT everywhere, RLS
-- is the ONLY thing standing between the publishable key and the data.
SELECT
  grantee,
  table_name,
  STRING_AGG(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;


-- ----------------------------------------------------------------------------
-- QUERY 7 — Summary verdict (one row: the headline)
-- ----------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity)                        AS tables_rls_off,
  COUNT(*)                                                            AS tables_total,
  (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname='public'
       AND (qual IS NULL OR btrim(qual) IN ('true','(true)')
            OR policyname ILIKE '%allow_all%' OR policyname ILIKE '%allow_auth%'))
                                                                      AS permissive_policies,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema='public' AND column_name ILIKE '%password%')  AS plaintext_password_cols
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
