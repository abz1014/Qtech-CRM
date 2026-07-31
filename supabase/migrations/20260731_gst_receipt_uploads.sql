-- ============================================================================
-- GST challan receipt uploads (Wasif & Co. FBR receipt attachments)
-- ============================================================================
-- Ticket: ad hoc, 2026-07-31
--
-- WHY STORAGE, NOT THE DATABASE
--   Free-tier Supabase gives 500MB *database* and a separate 1GB *Storage*
--   bucket. Scanned receipts belong in Storage -- storing them as bytea/base64
--   in a gst_invoices column would burn through the much smaller DB budget
--   and inflate ~33% from base64 encoding on top. The DB only ever holds a
--   path string; the actual file bytes live in the `gst-receipts` bucket.
--   Client-side compression (image resize + JPEG re-encode before upload,
--   see src/lib/storage/imageCompress.ts) keeps typical receipts under
--   ~300KB, so the 1GB bucket holds several thousand of them.
--
-- ACCESS: mirrors gst_invoices' own live RLS policy exactly (verified via
--   pg_policies before writing this, not assumed from the original migration
--   file) -- admin + sales, full read/write, no per-user scoping.
-- ============================================================================

-- ── Column: path within the bucket, not the file itself ─────────────────────
ALTER TABLE public.gst_invoices ADD COLUMN IF NOT EXISTS wasif_receipt_file_path TEXT;

-- ── Bucket: private (not public), 5MB cap enforced server-side too ──────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gst-receipts', 'gst-receipts', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS on storage.objects, scoped to this bucket only ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gst_receipts_rw') THEN
    CREATE POLICY "gst_receipts_rw" ON storage.objects FOR ALL
      USING (
        bucket_id = 'gst-receipts'
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'sales'))
      )
      WITH CHECK (
        bucket_id = 'gst-receipts'
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'sales'))
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
-- (a) Column exists.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gst_invoices' AND column_name = 'wasif_receipt_file_path';

-- (b) Bucket exists, private, with the size/type limits set.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'gst-receipts';

-- (c) Exactly one policy on storage.objects for this bucket.
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gst_receipts_rw';
