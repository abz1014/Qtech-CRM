import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RecurringExpense } from '@/types/bookkeeping';

export const RECURRING_EXPENSES_QUERY_KEY = ['recurring_expenses'] as const;

async function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase.from('recurring_expenses').select('*').order('label');
  if (error) throw new Error(`Failed to load recurring expenses: ${error.message}`);
  return (data ?? []) as unknown as RecurringExpense[];
}

/** Query-only variant, no realtime channel. Mutations stay in CRMContext (T2-4). */
export function useRecurringExpensesQuery() {
  return useQuery({ queryKey: RECURRING_EXPENSES_QUERY_KEY, queryFn: fetchRecurringExpenses });
}

/** Recurring expense templates with view-scoped realtime (T2-4). */
export function useRecurringExpenses() {
  const queryClient = useQueryClient();
  const query = useRecurringExpensesQuery();

  useEffect(() => {
    const channel = supabase
      .channel('recurring-expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: RECURRING_EXPENSES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
