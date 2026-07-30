import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SupplierInquiry } from '@/types/crm';

export const SUPPLIER_INQUIRIES_QUERY_KEY = ['supplier_inquiries'] as const;

async function fetchSupplierInquiries(): Promise<SupplierInquiry[]> {
  const { data, error } = await supabase.from('supplier_inquiries').select('*').order('sent_at', { ascending: false });
  if (error) throw new Error(`Failed to load supplier inquiries: ${error.message}`);
  return (data ?? []) as unknown as SupplierInquiry[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-3). */
export function useSupplierInquiriesQuery() {
  return useQuery({ queryKey: SUPPLIER_INQUIRIES_QUERY_KEY, queryFn: fetchSupplierInquiries });
}

/** Supplier inquiries with view-scoped realtime (T2-3). */
export function useSupplierInquiries() {
  const queryClient = useQueryClient();
  const query = useSupplierInquiriesQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`supplier-inquiries-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_inquiries' }, () => {
        queryClient.invalidateQueries({ queryKey: SUPPLIER_INQUIRIES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
