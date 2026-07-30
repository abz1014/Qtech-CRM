import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput } from '@/types/hr';
import { ATTENDANCE_QUERY_KEY } from '@/hooks/useAttendance';

export const EMPLOYEES_QUERY_KEY = ['employees'] as const;

async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) throw new Error(`Failed to load employees: ${error.message}`);
  return (data ?? []) as unknown as Employee[];
}

/**
 * Employee roster, cached via React Query and kept live via a realtime
 * subscription scoped to this hook's own lifetime -- it only listens while
 * a component using useEmployees is mounted, unlike CRMContext's old
 * always-on channel subscribed once for the whole app session (T2-1 pilot;
 * see docs/REACT_QUERY_PATTERN.md for the pattern this establishes).
 */
export function useEmployees() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: EMPLOYEES_QUERY_KEY, queryFn: fetchEmployees });

  useEffect(() => {
    const channel = supabase
      .channel(`employees-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useAddEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, createdBy }: { input: CreateEmployeeInput; createdBy: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .insert({ ...input, created_by: createdBy })
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to add employee: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Employee;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateEmployeeInput }) => {
      const { data, error } = await supabase
        .from('employees')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to update employee: ${error?.message ?? 'unknown error'}`);
      return data as unknown as Employee;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // attendance rows cascade in the DB (ON DELETE CASCADE)
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete employee: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
    },
  });
}
