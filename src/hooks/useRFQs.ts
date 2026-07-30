import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RFQ } from '@/types/crm';

export const RFQS_QUERY_KEY = ['rfqs'] as const;

async function fetchRFQs(): Promise<RFQ[]> {
  const { data, error } = await supabase.from('rfqs').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load RFQs: ${error.message}`);
  return (data ?? []) as unknown as RFQ[];
}

/**
 * Query-only variant, no realtime channel. CRMContext uses this internally
 * (stall-detection scan, convertRFQToOrder, addSupplierInquiry, getRFQMetrics,
 * deleteClient's unlink). All RFQ mutations stay in CRMContext -- see
 * useOrders.ts and docs/REACT_QUERY_PATTERN.md for why this domain didn't
 * move its mutations out like T2-2's clients/prospects/vendors did.
 */
export function useRFQsQuery() {
  return useQuery({ queryKey: RFQS_QUERY_KEY, queryFn: fetchRFQs });
}

/** RFQs with view-scoped realtime -- subscribes only while mounted (T2-3). */
export function useRFQs() {
  const queryClient = useQueryClient();
  const query = useRFQsQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`rfqs-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfqs' }, () => {
        queryClient.invalidateQueries({ queryKey: RFQS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
