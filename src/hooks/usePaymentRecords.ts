import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PaymentRecord } from '@/types/bookkeeping';

export const PAYMENT_RECORDS_QUERY_KEY = ['payment_records'] as const;

async function fetchPaymentRecords(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase.from('payment_records').select('*').order('payment_date', { ascending: false });
  if (error) throw new Error(`Failed to load payment records: ${error.message}`);
  return (data ?? []) as unknown as PaymentRecord[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function usePaymentRecordsQuery() {
  return useQuery({ queryKey: PAYMENT_RECORDS_QUERY_KEY, queryFn: fetchPaymentRecords });
}

/** Invoice payment records with view-scoped realtime (T2-4). */
export function usePaymentRecords() {
  const queryClient = useQueryClient();
  const query = usePaymentRecordsQuery();

  useEffect(() => {
    const channel = supabase
      .channel('payment-records-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records' }, () => {
        queryClient.invalidateQueries({ queryKey: PAYMENT_RECORDS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
