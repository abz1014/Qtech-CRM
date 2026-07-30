import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Client } from '@/types/crm';

export const CLIENTS_QUERY_KEY = ['clients'] as const;

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('company_name');
  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return (data ?? []) as unknown as Client[];
}

/**
 * Query-only variant, no realtime channel. CRMContext uses this internally
 * for getClientName + addOrder validation without pinning an app-lifetime
 * subscription; freshness there comes from the shared cache (updated by any
 * mounted useClients()) plus refetch-on-focus.
 */
export function useClientsQuery() {
  return useQuery({ queryKey: CLIENTS_QUERY_KEY, queryFn: fetchClients });
}

/** Clients with view-scoped realtime -- subscribes only while mounted (T2-2). */
export function useClients() {
  const queryClient = useQueryClient();
  const query = useClientsQuery();

  useEffect(() => {
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useAddClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (c: Omit<Client, 'id'>) => {
      const { data, error } = await supabase.from('clients').insert(c).select().single();
      if (error || !data) throw new Error(`Failed to add client: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Client;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Client, 'id'>> }) => {
      const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
      if (error || !data) throw new Error(`Failed to update client: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Client;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
  });
}

// deleteClient deliberately stays in CRMContext: it also unlinks the client's
// RFQs/orders and removes its follow-ups from context-held state (those
// domains migrate in T2-3), then invalidates CLIENTS_QUERY_KEY.
