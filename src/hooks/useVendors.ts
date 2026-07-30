import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/crm';

export const VENDORS_QUERY_KEY = ['vendors'] as const;

async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase.from('vendors').select('*').order('name');
  if (error) throw new Error(`Failed to load vendors: ${error.message}`);
  return (data ?? []) as unknown as Vendor[];
}

/**
 * Query-only variant, no realtime channel. CRMContext uses this internally
 * for getVendorName and the auto-follow-up titles in convertRFQToOrder /
 * addSupplierInquiry, without pinning an app-lifetime subscription.
 */
export function useVendorsQuery() {
  return useQuery({ queryKey: VENDORS_QUERY_KEY, queryFn: fetchVendors });
}

/** Vendors with view-scoped realtime -- subscribes only while mounted (T2-2). */
export function useVendors() {
  const queryClient = useQueryClient();
  const query = useVendorsQuery();

  useEffect(() => {
    const channel = supabase
      .channel('vendors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useAddVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<Vendor, 'id'>) => {
      const { data, error } = await supabase.from('vendors').insert(v).select().single();
      if (error || !data) throw new Error('Failed to create vendor');
      return data as unknown as Vendor;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY }),
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Vendor, 'id'>> }) => {
      const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single();
      if (error || !data) throw new Error(`Failed to update vendor: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Vendor;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY }),
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) {
        // 23503 = foreign_key_violation. orders.vendor_id is NO ACTION and
        // payables.vendor_id is RESTRICT (T1-3) -- surface that plainly.
        if (error.code === '23503') {
          throw new Error('Cannot delete vendor: it still has orders or payables on record.');
        }
        throw new Error(`Failed to delete vendor: ${error.message}`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY }),
  });
}
