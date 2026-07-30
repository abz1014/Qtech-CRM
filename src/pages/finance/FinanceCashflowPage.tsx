import { useFinanceReporting, monthLabel } from '@/hooks/useFinanceReporting';
import { useFinanceRange } from './FinanceLayout';
import { formatPKR } from '@/lib/format';
import { businessToday } from '@/lib/dates';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { cn } from '@/lib/utils';
import { Wallet, TrendingUp, Download } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

export default function FinanceCashflowPage() {
  const { range, isAllTime } = useFinanceRange();
  const f = useFinanceReporting(range, isAllTime);

  if (f.loading) return <TableSkeleton rows={8} />;

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Period: ${range.from} to ${range.to}`]);
    rows.push([]);
    rows.push(['P&L BY MONTH', 'Revenue', 'Cost', 'Expenses', 'Net']);
    f.pnl.forEach(r => rows.push([monthLabel(r.key), r.revenue, r.cost, r.expenses, r.net]));
    rows.push([]);
    rows.push(['CASH FLOW BY MONTH', 'In', 'Out', 'Net', 'Running']);
    f.cashflow.forEach(r => rows.push([monthLabel(r.key), r.cashIn, r.cashOut, r.net, r.running]));
    downloadCSV(generateCSV([`Q-Tech Cash Flow & P&L (generated ${businessToday()})`], rows), `CashFlow_PnL_${businessToday()}.csv`);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* ── Cash Flow ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="section-title flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Cash Flow <span className="normal-case tracking-normal font-normal text-muted-foreground">· actual money moved</span></p>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-lg tabular-nums', f.cashRunning >= 0 ? 'bg-primary/10 text-success' : 'bg-destructive/10 text-destructive')}>{formatPKR(f.cashRunning)} cash position</span>
        </div>
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">In</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Out</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Net</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Running</th>
              </tr>
            </thead>
            <tbody>
              {f.cashflow.map(r => {
                const w = Math.round((Math.abs(r.net) / f.maxNetFlow) * 50);
                return (
                  <tr key={r.key} className="border-b border-border/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">{monthLabel(r.key)}</td>
                    <td className="px-4 py-2.5 text-right text-success tabular-nums">{r.cashIn ? formatPKR(r.cashIn) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-warning tabular-nums">{r.cashOut ? formatPKR(r.cashOut) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className="relative w-[46px] h-1.5 rounded-sm bg-muted overflow-hidden flex-shrink-0">
                          <span className="absolute top-0 bottom-0" style={{ left: r.net >= 0 ? '50%' : `calc(50% - ${w}%)`, width: `${w}%`, background: r.net >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }} />
                        </span>
                        <span className={cn('font-semibold tabular-nums', r.net >= 0 ? 'text-success' : 'text-destructive')}>{formatPKR(r.net)}</span>
                      </span>
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', r.running >= 0 ? 'text-foreground' : 'text-destructive')}>{formatPKR(r.running)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5">In = customer payments received · Out = supplier payments + expenses, by the date the money actually moved.</p>
      </div>

      {/* ── P&L ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" /> Profit &amp; Loss <span className="normal-case tracking-normal font-normal text-muted-foreground">· booked, by PO date</span></p>
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Cost</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Expenses</th>
                <th className="text-right px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {f.pnl.map(r => (
                <tr key={r.key} className="border-b border-border/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{monthLabel(r.key)}</td>
                  <td className="px-4 py-2.5 text-right text-foreground tabular-nums">{r.revenue ? formatPKR(r.revenue) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-warning tabular-nums">{r.cost ? formatPKR(r.cost) : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.expenses ? 'hsl(22 90% 56%)' : undefined }}>{r.expenses ? formatPKR(r.expenses) : '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', r.net >= 0 ? 'text-success' : 'text-destructive')}>{formatPKR(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
