import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RFQLineItem } from '@/types/crm';

export const RFQ_LINE_ITEMS_QUERY_KEY = ['rfq_line_items'] as const;

async function fetchRFQLineItems(): Promise<RFQLineItem[]> {
  const { data, error } = await supabase.from('rfq_line_items').select('*');
  if (error) throw new Error(`Failed to load RFQ line items: ${error.message}`);
  return (data ?? []) as unknown as RFQLineItem[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-3). */
export function useRFQLineItemsQuery() {
  return useQuery({ queryKey: RFQ_LINE_ITEMS_QUERY_KEY, queryFn: fetchRFQLineItems });
}

/** RFQ line items with view-scoped realtime (T2-3). */
export function useRFQLineItems() {
  const queryClient = useQueryClient();
  const query = useRFQLineItemsQuery();

  useEffect(() => {
    const channel = supabase
      .channel('rfq-line-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_line_items' }, () => {
        queryClient.invalidateQueries({ queryKey: RFQ_LINE_ITEMS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
