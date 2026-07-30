import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Order, OrderStatus } from '@/types/crm';

export const ORDERS_QUERY_KEY = ['orders'] as const;

async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  // Safety net: the historical import used a legacy status 'completed'
  // (settled orders) that isn't in the app lifecycle. Normalize it to
  // 'payment_received' so it isn't counted as payment-pending. No-op once
  // the 20260711_fix_legacy_order_statuses migration has run everywhere.
  return ((data ?? []) as unknown as Order[]).map(o =>
    (o.status as string) === 'completed' ? { ...o, status: 'payment_received' as OrderStatus } : o
  );
}

/**
 * Query-only variant, no realtime channel. CRMContext uses this internally
 * (order mutations, stall-detection scan, convertRFQToOrder, deleteClient's
 * unlink) without pinning an app-lifetime subscription. All order mutations
 * stay in CRMContext -- addOrder/updateOrderStatus/convertRFQToOrder/etc are
 * deeply cross-coupled with rfqs, vendors, clients, and autoFollowUp, unlike
 * T2-2's clients/prospects/vendors (see docs/REACT_QUERY_PATTERN.md).
 */
export function useOrdersQuery() {
  return useQuery({ queryKey: ORDERS_QUERY_KEY, queryFn: fetchOrders });
}

/** Orders with view-scoped realtime -- subscribes only while mounted (T2-3). */
export function useOrders() {
  const queryClient = useQueryClient();
  const query = useOrdersQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`orders-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
