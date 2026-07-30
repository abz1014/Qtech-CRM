import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFinanceReporting } from '@/hooks/useFinanceReporting';
import { useFinanceRange } from './FinanceLayout';
import { formatPKR } from '@/lib/format';
import { businessToday } from '@/lib/dates';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { AlertCircle, CheckCircle, Download, X } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { Order } from '@/types/crm';

export default function FinanceReceivablesPage() {
  const { range, isAllTime } = useFinanceRange();
  const { addOrderPayment, getClientName } = useCRM();
  const { user } = useAuth();
  const navigate = useNavigate();
  const f = useFinanceReporting(range, isAllTime);

  const [payModal, setPayModal] = useState<{ order: Order } | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: businessToday(), payment_method: '', reference: '', notes: '' });

  if (f.loading) return <TableSkeleton rows={8} />;

  const openPayModal = (order: Order) => {
    const paid = f.paidInByOrder.get(order.id) ?? 0;
    setPayForm({ amount: String(Math.max(0, order.order_value - paid)), payment_date: businessToday(), payment_method: '', reference: '', notes: '' });
    setPayModal({ order });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal || !user) return;
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await addOrderPayment({
        order_id: payModal.order.id,
        amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        reference: payForm.reference,
        notes: payForm.notes,
      }, user.id);
      toast.success('Customer payment recorded');
      setPayModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [['Client', 'Order ID', 'Status', 'Paid', 'Order Value', 'Balance Due', 'Payment Due Date']];
    f.receivables.forEach(({ o, paid, balance }) => rows.push([getClientName(o.client_id), o.id, o.status, paid, o.order_value, balance, o.payment_due_date ?? '']));
    downloadCSV(generateCSV([`Q-Tech Receivables (generated ${businessToday()})`], rows), `Receivables_${businessToday()}.csv`);
  };

  const inputCls = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-lg bg-success/10 text-success font-semibold tabular-nums">{formatPKR(f.receivableTotal)} delivered &amp; unpaid</span>
          {f.overdueTotal > 0 && <span className="px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold tabular-nums">{formatPKR(f.overdueTotal)} overdue</span>}
          <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground font-semibold">{f.receivables.length} orders outstanding</span>
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="glass-card p-4 space-y-2">
        {f.receivables.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> Nothing outstanding — all orders fully paid.</p>
        ) : f.receivables.map(({ o, paid, balance }) => {
          const isOverdue = o.payment_due_date && String(o.payment_due_date).slice(0, 10) < f.todayStr;
          const pct = o.order_value > 0 ? Math.min(100, Math.round((paid / o.order_value) * 100)) : 0;
          return (
            <div key={o.id} className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                  <span className="text-sm font-semibold text-foreground truncate">{getClientName(o.client_id)}</span>
                  {o.invoice_number && <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{o.invoice_number}</span>}
                  {o.status === 'delivered' && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">DELIVERED</span>}
                  {isOverdue && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> OVERDUE</span>}
                </div>
                <button onClick={() => openPayModal(o)}
                  className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  Record Payment
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span>Paid {formatPKR(paid)} of {formatPKR(o.order_value)}</span>
                <span className="font-bold text-foreground">{formatPKR(balance)} due</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full rounded-full bg-success/70 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Record Customer Payment</h2>
              <button onClick={() => setPayModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{getClientName(payModal.order.client_id)} — order {formatPKR(payModal.order.order_value)}</p>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount (PKR)</label>
                <input type="number" min="1" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className={inputCls} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                  <input type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Method</label>
                  <input value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} placeholder="Bank / Cheque / Cash" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reference #</label>
                <input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} placeholder="Transaction / cheque number" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPayModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
