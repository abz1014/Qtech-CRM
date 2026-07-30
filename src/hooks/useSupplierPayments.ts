import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SupplierPayment } from '@/types/crm';

export const SUPPLIER_PAYMENTS_QUERY_KEY = ['supplier_payments'] as const;

async function fetchSupplierPayments(): Promise<SupplierPayment[]> {
  const { data, error } = await supabase.from('supplier_payments').select('*').order('payment_date', { ascending: false });
  if (error) throw new Error(`Failed to load supplier payments: ${error.message}`);
  return (data ?? []) as unknown as SupplierPayment[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useSupplierPaymentsQuery() {
  return useQuery({ queryKey: SUPPLIER_PAYMENTS_QUERY_KEY, queryFn: fetchSupplierPayments });
}

/** Supplier (vendor) payments with view-scoped realtime (T2-4). */
export function useSupplierPayments() {
  const queryClient = useQueryClient();
  const query = useSupplierPaymentsQuery();

  useEffect(() => {
    const channel = supabase
      .channel('supplier-payments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: SUPPLIER_PAYMENTS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
