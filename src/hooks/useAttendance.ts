import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AttendanceRecord, MarkAttendanceInput } from '@/types/hr';

export const ATTENDANCE_QUERY_KEY = ['attendance'] as const;

async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false });
  if (error) throw new Error(`Failed to load attendance: ${error.message}`);
  return (data ?? []) as unknown as AttendanceRecord[];
}

/**
 * Attendance records, cached via React Query and kept live via a realtime
 * subscription scoped to this hook's own lifetime -- it only listens while
 * a component using useAttendance is mounted, unlike CRMContext's old
 * always-on channel subscribed once for the whole app session.
 */
export function useAttendance() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ATTENDANCE_QUERY_KEY, queryFn: fetchAttendance });

  useEffect(() => {
    const channel = supabase
      .channel(`attendance-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

/** Marks a day for an employee. Upsert on (employee_id, date), so re-marking updates it. */
export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, createdBy }: { input: MarkAttendanceInput; createdBy: string }) => {
      const { data, error } = await supabase
        .from('attendance')
        .upsert({ ...input, created_by: createdBy }, { onConflict: 'employee_id,date' })
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to mark attendance: ${error?.message ?? 'unknown error'}`);
      return data as unknown as AttendanceRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY }),
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete attendance: ${error.message}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY }),
  });
}
