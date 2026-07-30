import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Prospect, Client } from '@/types/crm';
import { CLIENTS_QUERY_KEY } from '@/hooks/useClients';

export const PROSPECTS_QUERY_KEY = ['prospects'] as const;

async function fetchProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase.from('prospects').select('*').order('company_name');
  if (error) throw new Error(`Failed to load prospects: ${error.message}`);
  return (data ?? []) as unknown as Prospect[];
}

/** Query-only variant, no realtime channel. */
export function useProspectsQuery() {
  return useQuery({ queryKey: PROSPECTS_QUERY_KEY, queryFn: fetchProspects });
}

/** Prospects with view-scoped realtime -- subscribes only while mounted (T2-2). */
export function useProspects() {
  const queryClient = useQueryClient();
  const query = useProspectsQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`prospects-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, () => {
        queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

// addProspect deliberately stays in CRMContext: it fires the auto-follow-up
// ("Initial outreach to ...") through the context's autoFollowUp engine,
// then invalidates PROSPECTS_QUERY_KEY.

export function useUpdateProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Prospect, 'id' | 'converted_client_id'>> }) => {
      const { data, error } = await supabase.from('prospects').update(updates).eq('id', id).select().single();
      if (error || !data) throw new Error(`Failed to update prospect: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Prospect;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY }),
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prospects').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete prospect: ${error.message}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY }),
  });
}

/**
 * Converts a prospect into a client: inserts a client built from the
 * prospect's contact fields, then stamps converted_client_id on the
 * prospect. Reads the prospect FRESH from the DB rather than from any
 * cached copy -- the old CRMContext version read local React state, the
 * same stale-read pattern T1-2 eliminated from the payment flows.
 */
export function useConvertProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ prospectId, createdBy }: { prospectId: string; createdBy: string }) => {
      const { data: prospect, error: pErr } = await supabase
        .from('prospects').select('*').eq('id', prospectId).single();
      if (pErr || !prospect) throw new Error(`Failed to convert: prospect not found`);
      const p = prospect as unknown as Prospect;

      const { data: clientData, error: cErr } = await supabase.from('clients').insert({
        company_name: p.company_name,
        industry: '',
        contact_person: p.contact_person,
        phone: p.phone,
        email: p.email,
        address: '',
        created_by: createdBy || null,
      }).select().single();
      if (cErr || !clientData) throw new Error(`Failed to convert prospect: ${cErr?.message ?? 'unknown error'}`);

      const { error: uErr } = await supabase
        .from('prospects')
        .update({ converted_client_id: (clientData as unknown as Client).id })
        .eq('id', prospectId);
      if (uErr) throw new Error(`Client created but prospect not marked converted: ${uErr.message}`);

      return clientData as unknown as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
    },
  });
}
