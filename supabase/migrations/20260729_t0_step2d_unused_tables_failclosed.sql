-- ============================================================================
-- T0-2 STEP 2D — FAIL-CLOSE THE UNUSED TABLES
-- ============================================================================
-- Ticket: T0-2 (final cleanup)  |  Date: 2026-07-29
--
-- `documents` and `audit_log` exist in the live database but appear in NO
-- migration in this repo (undocumented drift) and are touched by NO code:
-- zero `.from('documents')`, zero `.from('audit_log')`, zero
-- `supabase.storage.from(...)` and zero `.rpc(...)` calls anywhere in src/.
--
-- They carried over-broad policies:
--   documents.allow_read_documents  SELECT USING (auth.uid() IS NOT NULL)
--       -> any logged-in user could read the table. This was the single
--          remaining "legacy permissive" policy after stage C.
--   audit_log."System can insert audit log"  INSERT USING auth.role()='authenticated'
--       -> any logged-in user could forge audit entries. If rows legitimately
--          appear in audit_log they are written by a DB trigger, which executes
--          as the table owner and is NOT subject to RLS -- so dropping this
--          policy does not stop legitimate logging.
--
-- Since no code path reads or writes either table, the correct end state is
-- RLS-enabled with NO policies = fail closed (same decision as `budgets` in
-- stage C). Recorded explicitly so a future reviewer does not "fix" the empty
-- policy list. If a documents/audit feature is ever built, add policies THEN.
-- ============================================================================

DROP POLICY IF EXISTS allow_read_documents                     ON public.documents;
DROP POLICY IF EXISTS "Sales and admin can upload documents"    ON public.documents;

DROP POLICY IF EXISTS "System can insert audit log"             ON public.audit_log;
DROP POLICY IF EXISTS "Admin can view audit log"                ON public.audit_log;


-- ----------------------------------------------------------------------------
-- FINAL T0-2 VERIFICATION — all four counts must be 0
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND policyname LIKE 'allow_%')                     AS legacy_permissive,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND cmd='ALL'
       AND btrim(COALESCE(qual,'')) IN ('true','(true)'))                         AS blanket_all,
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon')                              AS anon_grants,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND column_name ILIKE '%password%')              AS plaintext_pw;

-- Result on 2026-07-29: 0 | 0 | 0 | 0  -> T0-2 COMPLETE
