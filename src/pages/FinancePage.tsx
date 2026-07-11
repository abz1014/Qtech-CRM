import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Download,
  Wallet, Receipt, X, Plus, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { businessToday } from '@/lib/dates';
import { Order } from '@/types/crm';
import { ExpenseCategory } from '@/types/bookkeeping';

// ── Date range helpers ────────────────────────────────────────────────────────

type Preset = 'this_month' | 'last_3' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getPresetRange(preset: Preset): { from: string; to: string } {
  const today = businessToday();
  const y = parseInt(today.slice(0, 4));
  const m = parseInt(today.slice(5, 7)) - 1;

  // Read calendar parts directly — Date.toISOString() converts to UTC and
  // shifts local dates back a day (e.g. month start became prev month's last day).
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case 'this_month':
      return { from: fmt(new Date(y, m, 1)), to: today };
    case 'last_3':
      return { from: fmt(new Date(y, m - 2, 1)), to: today };
    case 'this_year':
      return { from: fmt(new Date(y, 0, 1)), to: today };
    case 'last_year':
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    case 'all_time':
      return { from: '2000-01-01', to: today };
    default:
      return { from: fmt(new Date(y, m, 1)), to: today };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_3',     label: 'Last 3 Months' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'all_time',   label: 'All Time' },
  { key: 'custom',     label: 'Custom' },
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Inventory/Procurement', 'Travel', 'Equipment', 'Office Expenses',
  'Salaries', 'Software Subscriptions', 'Utilities', 'Marketing', 'Misc',
];

// Month keys (YYYY-MM) between two dates, capped at 24
function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let y = parseInt(from.slice(0, 4)), m = parseInt(from.slice(5, 7));
  const ey = parseInt(to.slice(0, 4)), em = parseInt(to.slice(5, 7));
  while ((y < ey || (y === ey && m <= em)) && keys.length < 24) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return keys;
}

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
};

export default function FinancePage() {
  const {
    orders, orderPayments, supplierPayments, expenses,
    addOrderPayment, addSupplierPayment, addExpense,
    getClientName, getVendorName,
  } = useCRM();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Date range state ────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  const range = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    if (preset === 'custom') return getPresetRange('this_month');
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const todayStr = businessToday();

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [payModal, setPayModal] = useState<{ kind: 'in' | 'out'; order: Order } | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: businessToday(), payment_method: '', reference: '', notes: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: businessToday(), amount: '', category: 'Inventory/Procurement' as ExpenseCategory, description: '', order_id: '' });

  // ── Per-order payment totals ────────────────────────────────────────────────
  const paidInByOrder = useMemo(() => {
    const m = new Map<string, number>();
    orderPayments.forEach(p => m.set(p.order_id, (m.get(p.order_id) ?? 0) + p.amount));
    return m;
  }, [orderPayments]);
  const paidOutByOrder = useMemo(() => {
    const m = new Map<string, number>();
    supplierPayments.forEach(p => m.set(p.order_id, (m.get(p.order_id) ?? 0) + p.amount));
    return m;
  }, [supplierPayments]);

  // ── KPIs for the selected range (orders by PO date) ─────────────────────────
  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = o.customer_po_date || o.confirmed_date;
      if (!d) return preset === 'all_time';
      return d >= range.from && d <= range.to;
    }),
  [orders, range, preset]);

  const rangeExpenses = useMemo(
    () => expenses.filter(e => e.date >= range.from && e.date <= range.to),
    [expenses, range]);

  const revenue = filteredOrders.reduce((s, o) => s + (o.order_value || 0), 0);
  const cost    = filteredOrders.reduce((s, o) => s + (o.cost_value  || 0), 0);
  const expensesTotal = rangeExpenses.reduce((s, e) => s + e.amount, 0);
  const profit  = revenue - cost - expensesTotal;
  const margin  = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

  // ── Receivables: any order not fully paid by the customer ──────────────────
  const receivables = useMemo(() =>
    orders
      .filter(o => o.status !== 'payment_received')
      .map(o => {
        const paid = paidInByOrder.get(o.id) ?? 0;
        return { o, paid, balance: o.order_value - paid };
      })
      .filter(r => Math.round(r.balance * 100) > 0)
      .sort((a, b) => {
        // Delivered (true receivables) first, then largest balance
        const ad = a.o.status === 'delivered' ? 0 : 1;
        const bd = b.o.status === 'delivered' ? 0 : 1;
        return ad - bd || b.balance - a.balance;
      }),
  [orders, paidInByOrder]);
  const receivableTotal = receivables
    .filter(r => r.o.status === 'delivered')
    .reduce((s, r) => s + r.balance, 0);
  const overdueList = receivables.filter(r =>
    r.o.payment_due_date && String(r.o.payment_due_date).slice(0, 10) < todayStr);
  const overdueTotal = overdueList.reduce((s, r) => s + r.balance, 0);

  // ── Payables: supplier cost not yet fully paid out ──────────────────────────
  const payablesList = useMemo(() =>
    orders
      .filter(o => (o.cost_value || 0) > 0 && o.status !== 'payment_received')
      .map(o => {
        const paid = paidOutByOrder.get(o.id) ?? 0;
        return { o, paid, balance: (o.cost_value || 0) - paid };
      })
      .filter(r => Math.round(r.balance * 100) > 0)
      .sort((a, b) => b.balance - a.balance),
  [orders, paidOutByOrder]);
  const payableTotal = payablesList.reduce((s, r) => s + r.balance, 0);

  // ── Cash flow + P&L by month (within range) ─────────────────────────────────
  const months = useMemo(() => monthKeys(range.from, range.to), [range]);
  const cashflow = useMemo(() => {
    let running = 0;
    return months.map(k => {
      const cashIn  = orderPayments.filter(p => p.payment_date.startsWith(k)).reduce((s, p) => s + p.amount, 0);
      const cashOut = supplierPayments.filter(p => p.payment_date.startsWith(k)).reduce((s, p) => s + p.amount, 0)
                    + expenses.filter(e => e.date.startsWith(k)).reduce((s, e) => s + e.amount, 0);
      running += cashIn - cashOut;
      return { key: k, cashIn, cashOut, net: cashIn - cashOut, running };
    });
  }, [months, orderPayments, supplierPayments, expenses]);

  const pnl = useMemo(() => months.map(k => {
    const mo = orders.filter(o => (o.customer_po_date || o.confirmed_date || '').startsWith(k));
    const rev = mo.reduce((s, o) => s + (o.order_value || 0), 0);
    const cst = mo.reduce((s, o) => s + (o.cost_value || 0), 0);
    const exp = expenses.filter(e => e.date.startsWith(k)).reduce((s, e) => s + e.amount, 0);
    return { key: k, revenue: rev, cost: cst, expenses: exp, net: rev - cst - exp };
  }), [months, orders, expenses]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openPayModal = (kind: 'in' | 'out', order: Order) => {
    const paid = kind === 'in' ? (paidInByOrder.get(order.id) ?? 0) : (paidOutByOrder.get(order.id) ?? 0);
    const total = kind === 'in' ? order.order_value : (order.cost_value || 0);
    setPayForm({ amount: String(Math.max(0, total - paid)), payment_date: businessToday(), payment_method: '', reference: '', notes: '' });
    setPayModal({ kind, order });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal || !user) return;
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      const payload = {
        order_id: payModal.order.id,
        amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        reference: payForm.reference,
        notes: payForm.notes,
      };
      if (payModal.kind === 'in') await addOrderPayment(payload, user.id);
      else await addSupplierPayment(payload, user.id);
      toast.success(payModal.kind === 'in' ? 'Customer payment recorded' : 'Supplier payment recorded');
      setPayModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = Number(expenseForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await addExpense({
        date: expenseForm.date,
        amount,
        category: expenseForm.category,
        description: expenseForm.description,
        order_id: expenseForm.order_id || null,
      }, user.id);
      toast.success('Expense added');
      setShowExpenseModal(false);
      setExpenseForm({ date: businessToday(), amount: '', category: 'Inventory/Procurement', description: '', order_id: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense');
    }
  };

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Period: ${range.from} to ${range.to}`]);
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Booked Revenue (orders)', revenue]);
    rows.push(['Supplier Cost', cost]);
    rows.push(['Expenses', expensesTotal]);
    rows.push(['Net Profit', profit]);
    rows.push(['Margin %', margin]);
    rows.push(['Receivables (delivered, unpaid)', receivableTotal]);
    rows.push(['Overdue Receivables', overdueTotal]);
    rows.push(['Payables (owed to suppliers)', payableTotal]);
    rows.push([]);
    rows.push(['P&L BY MONTH', 'Revenue', 'Cost', 'Expenses', 'Net']);
    pnl.forEach(r => rows.push([monthLabel(r.key), r.revenue, r.cost, r.expenses, r.net]));
    rows.push([]);
    rows.push(['CASH FLOW BY MONTH', 'In', 'Out', 'Net', 'Running']);
    cashflow.forEach(r => rows.push([monthLabel(r.key), r.cashIn, r.cashOut, r.net, r.running]));
    downloadCSV(generateCSV([`Q-Tech Finance (generated ${businessToday()})`], rows), `Finance_${businessToday()}.csv`);
  };

  const inputCls = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="space-y-8">
      {/* ── Header + range ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Money in, money out, and what's owed — admin only</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {p.label}
            </button>
          ))}
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>
      {preset === 'custom' && (
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {/* ── KPIs (selected range) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Booked Revenue</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15 text-primary"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{formatPKR(revenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{filteredOrders.length} orders by PO date</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Supplier Cost</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/15 text-warning"><TrendingDown className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{formatPKR(cost)}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Expenses</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/15 text-info"><Receipt className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{formatPKR(expensesTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{rangeExpenses.length} entries</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">Net Profit</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${profit >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}><Wallet className="w-4 h-4" /></div>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${profit >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatPKR(profit)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{margin}% margin (after expenses)</p>
        </div>
      </div>

      {/* ── Receivables ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="section-title flex items-center gap-1.5">
            <ArrowDownCircle className="w-4 h-4 text-success" /> Receivables — Customers Owe Us
          </p>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">{formatPKR(receivableTotal)} delivered &amp; unpaid</span>
            {overdueTotal > 0 && <span className="px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold">{formatPKR(overdueTotal)} overdue</span>}
          </div>
        </div>
        <div className="glass-card p-4 space-y-2">
          {receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> Nothing outstanding — all orders fully paid.</p>
          ) : receivables.map(({ o, paid, balance }) => {
            const isOverdue = o.payment_due_date && String(o.payment_due_date).slice(0, 10) < todayStr;
            const pct = o.order_value > 0 ? Math.min(100, Math.round((paid / o.order_value) * 100)) : 0;
            return (
              <div key={o.id} className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                    <span className="text-sm font-semibold text-foreground truncate">{getClientName(o.client_id)}</span>
                    {o.invoice_number && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{o.invoice_number}</span>}
                    {o.status === 'delivered' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">DELIVERED</span>}
                    {isOverdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> OVERDUE</span>}
                  </div>
                  <button onClick={() => openPayModal('in', o)}
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
      </div>

      {/* ── Payables ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="section-title flex items-center gap-1.5">
            <ArrowUpCircle className="w-4 h-4 text-warning" /> Payables — We Owe Suppliers
          </p>
          <span className="px-2 py-1 rounded-lg bg-warning/10 text-warning font-semibold text-xs">{formatPKR(payableTotal)} outstanding</span>
        </div>
        <div className="glass-card p-4 space-y-2">
          {payablesList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> All suppliers fully paid.</p>
          ) : payablesList.map(({ o, paid, balance }) => {
            const total = o.cost_value || 0;
            const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            return (
              <div key={o.id} className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                    <span className="text-sm font-semibold text-foreground truncate">{getVendorName(o.vendor_id)}</span>
                    <span className="text-xs text-muted-foreground truncate">for {getClientName(o.client_id)}</span>
                    {paid > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-info/15 text-info">ADVANCE PAID</span>}
                  </div>
                  <button onClick={() => openPayModal('out', o)}
                    className="px-2.5 py-1 text-xs font-semibold bg-warning text-warning-foreground rounded-md hover:bg-warning/90 transition-colors">
                    Record Payment
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Paid {formatPKR(paid)} of {formatPKR(total)}</span>
                  <span className="font-bold text-foreground">{formatPKR(balance)} to pay</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-warning/70 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Expenses ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title flex items-center gap-1.5"><Receipt className="w-4 h-4 text-info" /> Expenses</p>
          <button onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </button>
        </div>
        <div className="glass-card p-4">
          {rangeExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No expenses recorded in this period.</p>
          ) : (
            <div className="space-y-1.5">
              {rangeExpenses.slice(0, 15).map(e => (
                <div key={e.expense_id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info flex-shrink-0">{e.category}</span>
                    <span className="text-sm text-foreground truncate">{e.description || '—'}</span>
                    {e.order_id && <span className="text-[10px] text-muted-foreground flex-shrink-0">↳ {getClientName(orders.find(o => o.id === e.order_id)?.client_id ?? '')}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    <span className="text-sm font-semibold text-foreground">{formatPKR(e.amount)}</span>
                  </div>
                </div>
              ))}
              {rangeExpenses.length > 15 && <p className="text-xs text-muted-foreground pt-1">…and {rangeExpenses.length - 15} more in this period (full list in CSV export)</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Cash Flow ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Cash Flow (actual money moved)</p>
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">In (customers)</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Out (suppliers + expenses)</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Running</th>
              </tr>
            </thead>
            <tbody>
              {cashflow.map(r => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-medium text-foreground">{monthLabel(r.key)}</td>
                  <td className="px-4 py-2.5 text-right text-success">{r.cashIn ? formatPKR(r.cashIn) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-warning">{r.cashOut ? formatPKR(r.cashOut) : '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold', r.net >= 0 ? 'text-success' : 'text-destructive')}>{formatPKR(r.net)}</td>
                  <td className={cn('px-4 py-2.5 text-right font-bold', r.running >= 0 ? 'text-foreground' : 'text-destructive')}>{formatPKR(r.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">In = customer payments received · Out = supplier payments + expenses, by the date the money actually moved.</p>
      </div>

      {/* ── P&L ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" /> Profit &amp; Loss (booked, by PO date)</p>
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Supplier Cost</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Expenses</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map(r => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-medium text-foreground">{monthLabel(r.key)}</td>
                  <td className="px-4 py-2.5 text-right text-foreground">{r.revenue ? formatPKR(r.revenue) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{r.cost ? formatPKR(r.cost) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{r.expenses ? formatPKR(r.expenses) : '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-bold', r.net >= 0 ? 'text-success' : 'text-destructive')}>{formatPKR(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Record payment modal ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                {payModal.kind === 'in' ? 'Record Customer Payment' : 'Record Supplier Payment'}
              </h2>
              <button onClick={() => setPayModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {payModal.kind === 'in'
                ? `${getClientName(payModal.order.client_id)} — order ${formatPKR(payModal.order.order_value)}`
                : `${getVendorName(payModal.order.vendor_id)} — cost ${formatPKR(payModal.order.cost_value || 0)}`}
            </p>
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

      {/* ── Add expense modal ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Amount (PKR)</label>
                  <input type="number" min="1" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} className={inputCls} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className={inputCls}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Customs clearing — Karachi port" className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Link to order (optional)</label>
                <select value={expenseForm.order_id} onChange={e => setExpenseForm(p => ({ ...p, order_id: e.target.value }))} className={inputCls}>
                  <option value="">— General expense —</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{getClientName(o.client_id)} · {o.product_type} · {formatPKR(o.order_value)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
