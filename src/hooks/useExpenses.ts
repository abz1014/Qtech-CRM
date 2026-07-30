import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types/bookkeeping';

export const EXPENSES_QUERY_KEY = ['expenses'] as const;

async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) throw new Error(`Failed to load expenses: ${error.message}`);
  return (data ?? []) as unknown as Expense[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useExpensesQuery() {
  return useQuery({ queryKey: EXPENSES_QUERY_KEY, queryFn: fetchExpenses });
}

/** Expenses with view-scoped realtime (T2-4). */
export function useExpenses() {
  const queryClient = useQueryClient();
  const query = useExpensesQuery();

  useEffect(() => {
    const channel = supabase
      .channel(`expenses-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
