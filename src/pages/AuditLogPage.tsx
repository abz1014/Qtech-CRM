import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { businessToday } from '@/lib/dates';
import { Download, ShieldCheck, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/Pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { AuditLogEntry, AuditAction } from '@/types/bookkeeping';

const TABLE_LABELS: Record<string, string> = {
  orders: 'Orders',
  order_payments: 'Customer Payments',
  supplier_payments: 'Supplier Payments',
  gst_invoices: 'GST Invoices',
  expenses: 'Expenses',
};

const ACTION_BADGE: Record<AuditAction, string> = {
  INSERT: 'bg-success/15 text-success',
  UPDATE: 'bg-info/15 text-info',
  DELETE: 'bg-destructive/15 text-destructive',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-PK');
  return String(v);
}

// Fields changed by an UPDATE, or every non-empty field for INSERT/DELETE.
function diffEntry(e: AuditLogEntry): { key: string; before: unknown; after: unknown }[] {
  if (e.action === 'INSERT') {
    return Object.entries(e.new_value ?? {})
      .filter(([, v]) => v !== null && v !== '' && v !== 0)
      .map(([key, v]) => ({ key, before: undefined, after: v }));
  }
  if (e.action === 'DELETE') {
    return Object.entries(e.old_value ?? {})
      .filter(([, v]) => v !== null && v !== '' && v !== 0)
      .map(([key, v]) => ({ key, before: v, after: undefined }));
  }
  const before = e.old_value ?? {};
  const after = e.new_value ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map(key => ({ key, before: before[key], after: after[key] }));
}

export default function AuditLogPage() {
  const { getUserName } = useCRM();
  const { data: entries = [], isLoading } = useAuditLog();

  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const tables = useMemo(() => [...new Set(entries.map(e => e.table_name))].sort(), [entries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter(e => {
      if (tableFilter !== 'all' && e.table_name !== tableFilter) return false;
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (term) {
        const actor = getUserName(e.changed_by ?? '').toLowerCase();
        const recordId = (e.record_id ?? '').toLowerCase();
        if (!actor.includes(term) && !recordId.includes(term)) return false;
      }
      return true;
    });
  }, [entries, tableFilter, actionFilter, search, getUserName]);

  const paged = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [['Timestamp', 'Table', 'Action', 'Actor', 'Record ID', 'Changed fields']];
    filtered.forEach(e => {
      const diff = diffEntry(e).map(d => `${d.key}: ${formatValue(d.before)} → ${formatValue(d.after)}`).join('; ');
      rows.push([formatDateTime(e.changed_at), TABLE_LABELS[e.table_name] ?? e.table_name, e.action, getUserName(e.changed_by ?? ''), e.record_id ?? '', diff]);
    });
    downloadCSV(generateCSV([`Q-Tech Audit Log (generated ${businessToday()})`], rows), `AuditLog_${businessToday()}.csv`);
  };

  const inputCls = 'px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  if (isLoading) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" /> Every financial and GST mutation, traceable to a user and timestamp — append-only, admin only.
        </p>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(1); }} className={inputCls}>
          <option value="all">All tables</option>
          {tables.map(t => <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value as 'all' | AuditAction); setPage(1); }} className={inputCls}>
          <option value="all">All actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search actor or record ID"
            className={cn(inputCls, 'pl-8 w-64')} />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} of {entries.length} entries</span>
      </div>

      <div className="glass-card p-0 overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {entries.length === 0 ? 'No audited mutations yet.' : 'No entries match these filters.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">When</th>
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Table</th>
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Actor</th>
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Change</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(e => {
                const diff = diffEntry(e);
                const isOpen = expanded.has(e.id);
                const preview = diff.slice(0, isOpen ? diff.length : 2);
                return (
                  <tr key={e.id} className="border-b border-border/40 align-top hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{formatDateTime(e.changed_at)}</td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{TABLE_LABELS[e.table_name] ?? e.table_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', ACTION_BADGE[e.action])}>{e.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{getUserName(e.changed_by ?? '')}</td>
                    <td className="px-4 py-2.5">
                      {diff.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {preview.map(d => (
                            <div key={d.key} className="text-xs">
                              <span className="text-muted-foreground">{d.key}:</span>{' '}
                              {d.before !== undefined && <span className="text-destructive/80 line-through decoration-destructive/50">{formatValue(d.before)}</span>}
                              {d.before !== undefined && d.after !== undefined && <span className="text-muted-foreground"> → </span>}
                              {d.after !== undefined && <span className="text-success">{formatValue(d.after)}</span>}
                            </div>
                          ))}
                          {diff.length > 2 && (
                            <button onClick={() => toggleExpanded(e.id)} className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                              {isOpen ? <>show less <ChevronUp className="w-3 h-3" /></> : <>+{diff.length - 2} more <ChevronDown className="w-3 h-3" /></>}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={itemsPerPage}
          onPageChange={setPage} onItemsPerPageChange={setItemsPerPage} />
      )}
    </div>
  );
}
