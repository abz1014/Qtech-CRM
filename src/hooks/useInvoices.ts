import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types/bookkeeping';

export const INVOICES_QUERY_KEY = ['invoices'] as const;

async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('issued_date', { ascending: false });
  if (error) throw new Error(`Failed to load invoices: ${error.message}`);
  return (data ?? []) as unknown as Invoice[];
}

/**
 * Query-only variant, no realtime channel. CRMContext uses this internally
 * for the financial reporting functions (getDashboardMetrics, getCashflowStatement,
 * getARAgingBuckets, etc.) that read across every finance/GST domain together.
 * Mutations (addInvoice/updateInvoice/deleteInvoice) stay in CRMContext for
 * the same reason as T2-3's rfqs/orders (see docs/REACT_QUERY_PATTERN.md).
 * Role gating (admin-only) is enforced by RLS + route-level RequireRole, not
 * by this hook -- the old isAdmin-conditional fetch was a perf optimization
 * (skip a doomed query), not a security boundary.
 */
export function useInvoicesQuery() {
  return useQuery({ queryKey: INVOICES_QUERY_KEY, queryFn: fetchInvoices });
}

/** Invoices with view-scoped realtime -- subscribes only while mounted (T2-4). */
export function useInvoices() {
  const queryClient = useQueryClient();
  const query = useInvoicesQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`invoices-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
