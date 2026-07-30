import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GstInvoice } from '@/types/bookkeeping';

export const GST_INVOICES_QUERY_KEY = ['gst_invoices'] as const;

async function fetchGstInvoices(): Promise<GstInvoice[]> {
  const { data, error } = await supabase.from('gst_invoices').select('*').order('invoice_date', { ascending: false });
  if (error) throw new Error(`Failed to load GST invoices: ${error.message}`);
  return (data ?? []) as unknown as GstInvoice[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useGstInvoicesQuery() {
  return useQuery({ queryKey: GST_INVOICES_QUERY_KEY, queryFn: fetchGstInvoices });
}

/** GST invoices with view-scoped realtime (T2-4). */
export function useGstInvoices() {
  const queryClient = useQueryClient();
  const query = useGstInvoicesQuery();

  useEffect(() => {
    const channel = supabase
      .channel('gst-invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gst_invoices' }, () => {
        queryClient.invalidateQueries({ queryKey: GST_INVOICES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
