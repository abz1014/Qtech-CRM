import { useNavigate } from 'react-router-dom';
import { useFinanceReporting, monthKeyLabel, currentMonthKey } from '@/hooks/useFinanceReporting';
import { useFinanceRange } from './FinanceLayout';
import { formatPKR } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { businessToday } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  Download, CalendarClock, ArrowDownCircle, ShieldAlert, ChevronRight, AlertCircle,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

export default function FinanceOverviewPage() {
  const { range, rangeLabel, isAllTime } = useFinanceRange();
  const navigate = useNavigate();
  const f = useFinanceReporting(range, isAllTime);
  const currentMonth = currentMonthKey();

  if (f.loading) return <TableSkeleton rows={6} />;

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Period: ${range.from} to ${range.to}`]);
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Booked Revenue (orders)', f.revenue]);
    rows.push(['Supplier Cost', f.cost]);
    rows.push(['Expenses', f.expensesTotal]);
    rows.push(['Net Profit', f.profit]);
    rows.push(['Margin %', f.margin]);
    rows.push(['Receivables (delivered, unpaid)', f.receivableTotal]);
    rows.push(['Overdue Receivables', f.overdueTotal]);
    rows.push([]);
    rows.push(['RECONCILIATION EXCEPTIONS', 'Severity', 'Category', 'Message', 'Order ID', 'GST Invoice ID']);
    f.exceptions.forEach(e => rows.push([e.severity, e.category, e.message, e.orderId ?? '', e.gstInvoiceId ?? '']));
    downloadCSV(generateCSV([`Q-Tech Finance Overview (generated ${businessToday()})`], rows), `Finance_Overview_${businessToday()}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* ── Period P&L — where every booked rupee goes ── */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="section-title">Net profit · {rangeLabel}</p>
            <p className={cn('text-4xl sm:text-5xl font-extrabold tracking-tight mt-1.5 tabular-nums', f.profit >= 0 ? 'text-primary' : 'text-destructive')}>{formatPKR(f.profit)}</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              on <span className="font-semibold text-foreground tabular-nums">{formatPKR(f.revenue)}</span> booked
              <span className="text-muted-foreground/50"> · </span>
              <span className={cn('font-semibold tabular-nums', f.profit >= 0 ? 'text-success' : 'text-destructive')}>{f.margin}% margin</span>
              <span className="text-muted-foreground/50"> · </span>{f.filteredOrders.length} orders by PO date
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">Where it went</p>
            <p className="text-xl font-extrabold tracking-tight mt-1.5 tabular-nums" style={{ color: 'hsl(35 92% 52%)' }}>{formatPKR(f.cost)} <span className="text-[12px] text-muted-foreground font-medium">supplier cost</span></p>
            <p className="text-base font-bold tracking-tight tabular-nums" style={{ color: 'hsl(22 90% 56%)' }}>{formatPKR(f.expensesTotal)} <span className="text-[12px] text-muted-foreground font-medium">expenses</span></p>
          </div>
        </div>

        {f.revenue > 0 ? (
          <>
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 mt-5">
              <div className="flex items-center pl-2.5 text-[12px] font-bold text-black/75 whitespace-nowrap overflow-hidden" style={{ flexGrow: Math.max(0, f.cost), flexBasis: 0, background: 'hsl(35 92% 52%)' }} title={`Supplier cost ${formatPKR(f.cost)}`}>{f.cost / f.revenue > 0.08 ? 'Cost' : ''}</div>
              <div className="flex items-center pl-2 text-[12px] font-bold text-black/75 whitespace-nowrap overflow-hidden" style={{ flexGrow: Math.max(0, f.expensesTotal), flexBasis: 0, background: 'hsl(22 90% 56%)' }} title={`Expenses ${formatPKR(f.expensesTotal)}`}>{f.expensesTotal / f.revenue > 0.07 ? 'Exp' : ''}</div>
              {f.profit > 0 && <div className="flex items-center pl-2.5 text-[12px] font-bold text-white whitespace-nowrap overflow-hidden" style={{ flexGrow: f.profit, flexBasis: 0, background: 'hsl(var(--primary))' }} title={`Net profit ${formatPKR(f.profit)}`}>{f.profit / f.revenue > 0.08 ? 'Profit' : ''}</div>}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
              <LegendItem color="hsl(var(--muted-foreground))" label="Booked revenue" value={formatPKR(f.revenue)} />
              <LegendItem color="hsl(35 92% 52%)" label="Supplier cost" value={formatPKR(f.cost)} pct={(f.cost / f.revenue) * 100} />
              <LegendItem color="hsl(22 90% 56%)" label="Expenses" value={formatPKR(f.expensesTotal)} pct={(f.expensesTotal / f.revenue) * 100} />
              <LegendItem color="hsl(var(--primary))" label="Net profit" value={formatPKR(f.profit)} pct={(f.profit / f.revenue) * 100} valueClass={f.profit >= 0 ? 'text-success' : 'text-destructive'} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-4">No revenue booked in this period.</p>
        )}
      </div>

      {/* ── Recurring reminder banner (current month) ── */}
      {f.dueThisMonth.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-foreground flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              <strong>{f.dueThisMonth.length}</strong> recurring {f.dueThisMonth.length === 1 ? 'expense' : 'expenses'} not yet posted for {monthKeyLabel(currentMonth)}
              <span className="text-muted-foreground"> · {formatPKR(f.dueThisMonth.reduce((s, t) => s + t.amount, 0))}</span>
            </span>
          </p>
          <button onClick={() => navigate('/finance/expenses')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-500/90 transition-colors flex-shrink-0">
            Review &amp; post
          </button>
        </div>
      )}

      {/* ── Compact drill-down cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => navigate('/finance/receivables')}
          className="glass-card p-5 text-left hover:bg-muted/30 transition-colors group">
          <div className="flex items-center justify-between mb-2">
            <p className="section-title flex items-center gap-1.5"><ArrowDownCircle className="w-4 h-4 text-success" /> Receivables</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-2xl font-extrabold tabular-nums text-foreground">{formatPKR(f.receivableTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">delivered &amp; unpaid, across {f.receivables.length} orders</p>
          {f.overdueTotal > 0 && (
            <p className="text-xs font-semibold text-destructive mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {formatPKR(f.overdueTotal)} overdue
            </p>
          )}
        </button>

        <button onClick={() => navigate('/finance/reconciliation')}
          className="glass-card p-5 text-left hover:bg-muted/30 transition-colors group">
          <div className="flex items-center justify-between mb-2">
            <p className="section-title flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-warning" /> Reconciliation</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
          {f.exceptions.length === 0 ? (
            <p className="text-2xl font-extrabold tabular-nums text-success">All clear</p>
          ) : (
            <p className="text-2xl font-extrabold tabular-nums text-foreground">{f.exceptions.length} exception{f.exceptions.length === 1 ? '' : 's'}</p>
          )}
          <div className="flex gap-2 mt-2">
            {f.criticalCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive">{f.criticalCount} critical</span>}
            {f.warningCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">{f.warningCount} warning</span>}
            {f.exceptions.length === 0 && <span className="text-xs text-muted-foreground">orders, payments &amp; GST all in balance</span>}
          </div>
        </button>
      </div>
    </div>
  );
}

// One term of the P&L flow bar: swatch + label + figure (+ share of revenue).
function LegendItem({ color, label, value, pct, valueClass }: { color: string; label: string; value: string; pct?: number; valueClass?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5" style={{ background: color }} />
      <div>
        <p className="text-[12px] text-muted-foreground leading-tight">{label}</p>
        <p className={cn('text-sm font-bold tracking-tight tabular-nums', valueClass)}>
          {value}{pct !== undefined && <span className="text-[11px] text-muted-foreground font-normal ml-1">{pct.toFixed(1)}%</span>}
        </p>
      </div>
    </div>
  );
}
