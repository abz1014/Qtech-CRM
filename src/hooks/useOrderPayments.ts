import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OrderPayment } from '@/types/crm';

export const ORDER_PAYMENTS_QUERY_KEY = ['order_payments'] as const;

async function fetchOrderPayments(): Promise<OrderPayment[]> {
  const { data, error } = await supabase.from('order_payments').select('*').order('payment_date', { ascending: false });
  if (error) throw new Error(`Failed to load order payments: ${error.message}`);
  return (data ?? []) as unknown as OrderPayment[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useOrderPaymentsQuery() {
  return useQuery({ queryKey: ORDER_PAYMENTS_QUERY_KEY, queryFn: fetchOrderPayments });
}

/** Order (customer) payments with view-scoped realtime (T2-4). */
export function useOrderPayments() {
  const queryClient = useQueryClient();
  const query = useOrderPaymentsQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`order-payments-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ORDER_PAYMENTS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
