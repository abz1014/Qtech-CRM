import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CostLine } from '@/types/crm';

export const COST_LINES_QUERY_KEY = ['cost_lines'] as const;

async function fetchCostLines(): Promise<CostLine[]> {
  const { data, error } = await supabase.from('cost_lines').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(`Failed to load cost lines: ${error.message}`);
  return (data ?? []) as unknown as CostLine[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useCostLinesQuery() {
  return useQuery({ queryKey: COST_LINES_QUERY_KEY, queryFn: fetchCostLines });
}

/** Costing lines (admin + sales; RLS enforces access) with view-scoped realtime (T2-4). */
export function useCostLines() {
  const queryClient = useQueryClient();
  const query = useCostLinesQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`cost-lines-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_lines' }, () => {
        queryClient.invalidateQueries({ queryKey: COST_LINES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
