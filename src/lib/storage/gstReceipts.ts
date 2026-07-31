import { supabase } from '@/lib/supabase';
import { compressIfImage } from './imageCompress';

export const GST_RECEIPTS_BUCKET = 'gst-receipts';

// Hard ceiling AFTER compression. A legible compressed receipt image lands
// well under 1MB; this only ever bites on an oversized PDF, and 5MB is still
// a fraction of Supabase's own 50MB per-file limit.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export class ReceiptUploadError extends Error {}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Compress (if an image), validate, and upload a challan receipt for a GST invoice. Returns the storage path to save on the record. */
export async function uploadGstReceipt(gstInvoiceId: string, file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ReceiptUploadError('Only images (JPEG/PNG/WebP/HEIC) or PDFs are accepted.');
  }

  const processed = await compressIfImage(file);

  if (processed.size > MAX_UPLOAD_BYTES) {
    const mb = (processed.size / (1024 * 1024)).toFixed(1);
    throw new ReceiptUploadError(`File is ${mb}MB after compression — please use a smaller scan or photo (max 5MB).`);
  }

  const path = `${gstInvoiceId}/${Date.now()}-${sanitizeFilename(processed.name)}`;
  const { error } = await supabase.storage.from(GST_RECEIPTS_BUCKET).upload(path, processed, {
    contentType: processed.type,
    upsert: false,
  });
  if (error) throw new ReceiptUploadError(`Upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL to view/download a receipt — never a permanent public link for a financial document. */
export async function getGstReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(GST_RECEIPTS_BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new Error(`Failed to open receipt: ${error?.message ?? 'unknown error'}`);
  return data.signedUrl;
}

export async function deleteGstReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from(GST_RECEIPTS_BUCKET).remove([path]);
  if (error) throw new Error(`Failed to delete receipt: ${error.message}`);
}
