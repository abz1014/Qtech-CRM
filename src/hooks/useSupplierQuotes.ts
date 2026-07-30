import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SupplierQuote } from '@/types/crm';

export const SUPPLIER_QUOTES_QUERY_KEY = ['supplier_quotes'] as const;

async function fetchSupplierQuotes(): Promise<SupplierQuote[]> {
  const { data, error } = await supabase.from('supplier_quotes').select('*').order('received_at', { ascending: false });
  if (error) throw new Error(`Failed to load supplier quotes: ${error.message}`);
  return (data ?? []) as unknown as SupplierQuote[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-3). */
export function useSupplierQuotesQuery() {
  return useQuery({ queryKey: SUPPLIER_QUOTES_QUERY_KEY, queryFn: fetchSupplierQuotes });
}

/** Supplier quotes with view-scoped realtime (T2-3). */
export function useSupplierQuotes() {
  const queryClient = useQueryClient();
  const query = useSupplierQuotesQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`supplier-quotes-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_quotes' }, () => {
        queryClient.invalidateQueries({ queryKey: SUPPLIER_QUOTES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
