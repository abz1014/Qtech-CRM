import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CostingConfig } from '@/types/crm';

export const COSTING_CONFIG_QUERY_KEY = ['costing_config'] as const;

async function fetchCostingConfig(): Promise<CostingConfig | null> {
  const { data, error } = await supabase.from('costing_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`Failed to load costing config: ${error.message}`);
  return (data ?? null) as unknown as CostingConfig | null;
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useCostingConfigQuery() {
  return useQuery({ queryKey: COSTING_CONFIG_QUERY_KEY, queryFn: fetchCostingConfig });
}

/** The shared costing config singleton (admin + sales) with view-scoped realtime (T2-4). */
export function useCostingConfig() {
  const queryClient = useQueryClient();
  const query = useCostingConfigQuery();

  useEffect(() => {
    const channel = supabase
      .channel('costing-config-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costing_config' }, () => {
        queryClient.invalidateQueries({ queryKey: COSTING_CONFIG_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
