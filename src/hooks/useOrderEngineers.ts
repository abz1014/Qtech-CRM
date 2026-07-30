import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OrderEngineer } from '@/types/crm';

export const ORDER_ENGINEERS_QUERY_KEY = ['order_engineers'] as const;

async function fetchOrderEngineers(): Promise<OrderEngineer[]> {
  const { data, error } = await supabase.from('order_engineers').select('*');
  if (error) throw new Error(`Failed to load engineer assignments: ${error.message}`);
  return (data ?? []) as unknown as OrderEngineer[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-3). */
export function useOrderEngineersQuery() {
  return useQuery({ queryKey: ORDER_ENGINEERS_QUERY_KEY, queryFn: fetchOrderEngineers });
}

/** Order-engineer assignments with view-scoped realtime (T2-3). */
export function useOrderEngineers() {
  const queryClient = useQueryClient();
  const query = useOrderEngineersQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`order-engineers-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_engineers' }, () => {
        queryClient.invalidateQueries({ queryKey: ORDER_ENGINEERS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
