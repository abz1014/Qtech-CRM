import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Payable } from '@/types/bookkeeping';

export const PAYABLES_QUERY_KEY = ['payables'] as const;

async function fetchPayables(): Promise<Payable[]> {
  const { data, error } = await supabase.from('payables').select('*').order('due_date', { ascending: false });
  if (error) throw new Error(`Failed to load payables: ${error.message}`);
  return (data ?? []) as unknown as Payable[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function usePayablesQuery() {
  return useQuery({ queryKey: PAYABLES_QUERY_KEY, queryFn: fetchPayables });
}

/** Payables with view-scoped realtime (T2-4). */
export function usePayables() {
  const queryClient = useQueryClient();
  const query = usePayablesQuery();

  useEffect(() => {
    const channel = supabase
      .channel('payables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payables' }, () => {
        queryClient.invalidateQueries({ queryKey: PAYABLES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
