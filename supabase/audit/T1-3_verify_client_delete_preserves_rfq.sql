-- Read-only. Confirms the T1-3-VERIFY-RFQ (created and its client deleted
-- via the live UI) survived with client_id set to NULL, not deleted.
SELECT id, rfq_number, company_name, client_id, status
FROM public.rfqs
WHERE rfq_number = 'T1-3-VERIFY-RFQ';
