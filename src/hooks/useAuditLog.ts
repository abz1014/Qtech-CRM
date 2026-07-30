import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AuditLogEntry } from '@/types/bookkeeping';

export const AUDIT_LOG_QUERY_KEY = ['audit_log'] as const;

async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to load audit log: ${error.message}`);
  return (data ?? []) as unknown as AuditLogEntry[];
}

/** Admin-only audit trail (RLS-gated) with view-scoped realtime (T2-6). */
export function useAuditLog() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: AUDIT_LOG_QUERY_KEY, queryFn: fetchAuditLog });

  useEffect(() => {
    const channel = supabase
      .channel(`audit-log-changes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
