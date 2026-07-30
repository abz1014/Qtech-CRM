import { useNavigate } from 'react-router-dom';
import { useFinanceReporting } from '@/hooks/useFinanceReporting';
import { useFinanceRange } from './FinanceLayout';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { businessToday } from '@/lib/dates';
import { AlertCircle, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

export default function FinanceReconciliationPage() {
  const { range, isAllTime } = useFinanceRange();
  const navigate = useNavigate();
  const f = useFinanceReporting(range, isAllTime);

  if (f.loading) return <TableSkeleton rows={8} />;

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [['Severity', 'Category', 'Message', 'Order ID', 'GST Invoice ID']];
    f.exceptions.forEach(e => rows.push([e.severity, e.category, e.message, e.orderId ?? '', e.gstInvoiceId ?? '']));
    downloadCSV(generateCSV([`Q-Tech Reconciliation Exceptions (generated ${businessToday()})`], rows), `Reconciliation_${businessToday()}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 text-xs">
          {f.criticalCount > 0 && <span className="px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold tabular-nums">{f.criticalCount} critical</span>}
          {f.warningCount > 0 && <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{f.warningCount} warning</span>}
          {f.exceptions.length === 0 && <span className="px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">All clear</span>}
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="glass-card p-4 space-y-1.5">
        {f.exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> No exceptions — orders, payments, and GST invoices are all in balance and in sequence.</p>
        ) : f.exceptions.map(e => (
          <div key={e.key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
            {e.severity === 'critical'
              ? <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{e.category}</span>
                {e.orderId && (
                  <button onClick={() => navigate(`/orders/${e.orderId}`)} className="text-[11px] text-primary hover:underline flex-shrink-0">
                    view order
                  </button>
                )}
                {e.gstInvoiceId && (
                  <button onClick={() => navigate('/gst-register')} className="text-[11px] text-primary hover:underline flex-shrink-0">
                    view GST register
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground mt-0.5">{e.message}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">Cross-checks orders, customer/supplier payments, and the GST register — not a data quality score, just what needs a human look. Not scoped to the period filter — always checks everything.</p>
    </div>
  );
}
