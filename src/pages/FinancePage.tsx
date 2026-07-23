import { useState, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPKR, formatDate } from '@/lib/format';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Download,
  Wallet, Receipt, X, Plus, ArrowDownCircle,
  Repeat, Pencil, Trash2, PieChart, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { businessToday } from '@/lib/dates';
import { Order } from '@/types/crm';
import { ExpenseCategory, RecurringExpense } from '@/types/bookkeeping';

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

// Stable colour per expense category for the "Spend by Category" bar.
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Salaries':               'bg-primary',
  'Inventory/Procurement':  'bg-info',
  'Utilities':              'bg-amber-500',
  'Travel':                 'bg-cyan-500',
  'Equipment':              'bg-violet-500',
  'Office Expenses':        'bg-emerald-500',
  'Software Subscriptions': 'bg-pink-500',
  'Marketing':              'bg-orange-500',
  'Misc':                   'bg-muted-foreground',
};

const currentMonthKey = () => businessToday().slice(0, 7); // YYYY-MM
const monthKeyLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

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
    recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, postRecurringExpenses,
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

  // ── Recurring expense state ─────────────────────────────────────────────────
  const [recurringModal, setRecurringModal] = useState<{ mode: 'add' | 'edit'; template?: RecurringExpense } | null>(null);
  const [recurringForm, setRecurringForm] = useState({ label: '', category: 'Salaries' as ExpenseCategory, amount: '', day_of_month: '1', start_month: '', notes: '' });
  const [postMonth, setPostMonth] = useState(currentMonthKey());
  const [postModal, setPostModal] = useState<{ period: string } | null>(null);
  const [postDrafts, setPostDrafts] = useState<Record<string, { checked: boolean; amount: string }>>({});
  const [posting, setPosting] = useState(false);

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

  // ── Spend by category (selected range) ──────────────────────────────────────
  const spendByCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    rangeExpenses.forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    const total = [...m.values()].reduce((s, v) => s + v, 0);
    return {
      total,
      rows: [...m.entries()]
        .map(([category, amount]) => ({ category, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [rangeExpenses]);

  // ── Recurring: which templates are already posted, and which are due ────────
  const postedSet = useMemo(() => {
    const s = new Set<string>();
    expenses.forEach(e => { if (e.recurring_id && e.period) s.add(`${e.recurring_id}|${e.period}`); });
    return s;
  }, [expenses]);

  const dueForMonth = useCallback((period: string): RecurringExpense[] =>
    recurringExpenses.filter(t =>
      t.active &&
      (!t.start_month || t.start_month <= period) &&
      !postedSet.has(`${t.id}|${period}`)
    ),
  [recurringExpenses, postedSet]);

  const currentMonth = currentMonthKey();
  const dueThisMonth = useMemo(() => dueForMonth(currentMonth), [dueForMonth, currentMonth]);
  const dueForPostMonth = useMemo(() => dueForMonth(postMonth), [dueForMonth, postMonth]);
  const recurringMonthlyTotal = useMemo(
    () => recurringExpenses.filter(t => t.active).reduce((s, t) => s + t.amount, 0),
    [recurringExpenses]);

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

  // ── Recurring handlers ──────────────────────────────────────────────────────
  const openRecurringAdd = () => {
    setRecurringForm({ label: '', category: 'Salaries', amount: '', day_of_month: '1', start_month: '', notes: '' });
    setRecurringModal({ mode: 'add' });
  };
  const openRecurringEdit = (t: RecurringExpense) => {
    setRecurringForm({
      label: t.label, category: t.category, amount: String(t.amount),
      day_of_month: String(t.day_of_month), start_month: t.start_month || '', notes: t.notes || '',
    });
    setRecurringModal({ mode: 'edit', template: t });
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recurringModal) return;
    const amount = Number(recurringForm.amount);
    if (!recurringForm.label.trim()) { toast.error('Enter a label'); return; }
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const day = Math.min(28, Math.max(1, Number(recurringForm.day_of_month) || 1));
    const payload = {
      label: recurringForm.label.trim(),
      category: recurringForm.category,
      amount,
      day_of_month: day,
      start_month: recurringForm.start_month || '',
      notes: recurringForm.notes || null,
    };
    try {
      if (recurringModal.mode === 'add') await addRecurringExpense(payload, user.id);
      else if (recurringModal.template) await updateRecurringExpense(recurringModal.template.id, payload);
      toast.success(recurringModal.mode === 'add' ? 'Recurring expense added' : 'Recurring expense updated');
      setRecurringModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recurring expense');
    }
  };

  const handleToggleActive = async (t: RecurringExpense) => {
    try {
      await updateRecurringExpense(t.id, { active: !t.active });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDeleteRecurring = async (t: RecurringExpense) => {
    if (!window.confirm(`Delete recurring expense "${t.label}"? Already-posted months stay in the ledger.`)) return;
    try {
      await deleteRecurringExpense(t.id);
      toast.success('Recurring expense deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const openPostModal = (period: string) => {
    const due = dueForMonth(period);
    if (due.length === 0) { toast.info(`Nothing due for ${monthKeyLabel(period)} — all posted.`); return; }
    const drafts: Record<string, { checked: boolean; amount: string }> = {};
    due.forEach(t => { drafts[t.id] = { checked: true, amount: String(t.amount) }; });
    setPostDrafts(drafts);
    setPostMonth(period);
    setPostModal({ period });
  };

  const handlePostRecurring = async () => {
    if (!user || !postModal) return;
    const items = Object.entries(postDrafts)
      .filter(([, d]) => d.checked)
      .map(([id, d]) => ({ id, amount: Number(d.amount) || 0 }))
      .filter(i => i.amount > 0);
    if (items.length === 0) { toast.error('Select at least one item with a valid amount'); return; }
    setPosting(true);
    try {
      const n = await postRecurringExpenses(postModal.period, items, user.id);
      toast.success(n > 0 ? `Posted ${n} recurring ${n === 1 ? 'expense' : 'expenses'} for ${monthKeyLabel(postModal.period)}` : 'Already posted — nothing to add');
      setPostModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post recurring expenses');
    } finally { setPosting(false); }
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
    rows.push([]);
    rows.push(['SPEND BY CATEGORY', 'Amount', '% of expenses']);
    spendByCategory.rows.forEach(r => rows.push([r.category, r.amount, `${r.pct.toFixed(1)}%`]));
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

      {/* ── Recurring reminder banner (current month) ── */}
      {dueThisMonth.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-foreground flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              <strong>{dueThisMonth.length}</strong> recurring {dueThisMonth.length === 1 ? 'expense' : 'expenses'} not yet posted for {monthKeyLabel(currentMonth)}
              <span className="text-muted-foreground"> · {formatPKR(dueThisMonth.reduce((s, t) => s + t.amount, 0))}</span>
            </span>
          </p>
          <button onClick={() => openPostModal(currentMonth)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-500/90 transition-colors flex-shrink-0">
            Review &amp; post
          </button>
        </div>
      )}

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
                    {e.recurring_id && <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5" title="Posted from a recurring template"><Repeat className="w-3 h-3" /> recurring</span>}
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

      {/* ── Spend by Category ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><PieChart className="w-4 h-4 text-info" /> Spend by Category <span className="text-xs font-normal text-muted-foreground">· {formatPKR(spendByCategory.total)} in this period</span></p>
        <div className="glass-card p-4">
          {spendByCategory.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No expenses to break down in this period.</p>
          ) : (
            <>
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-4">
                {spendByCategory.rows.map(r => (
                  r.pct > 0 ? <div key={r.category} className={CATEGORY_COLORS[r.category]} style={{ width: `${r.pct}%` }} title={`${r.category}: ${r.pct.toFixed(1)}%`} /> : null
                ))}
              </div>
              <div className="space-y-2.5">
                {spendByCategory.rows.map(r => (
                  <div key={r.category} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[r.category]} flex-shrink-0`} />
                    <span className="text-sm text-foreground w-44 flex-shrink-0 truncate">{r.category}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${CATEGORY_COLORS[r.category]} opacity-70`} style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-28 text-right flex-shrink-0">{formatPKR(r.amount)}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">{r.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Recurring Expenses ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="section-title flex items-center gap-1.5">
            <Repeat className="w-4 h-4 text-primary" /> Recurring Expenses
            {recurringMonthlyTotal > 0 && <span className="text-xs font-normal text-muted-foreground">· {formatPKR(recurringMonthlyTotal)}/mo active</span>}
          </p>
          <button onClick={openRecurringAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Recurring
          </button>
        </div>
        <div className="glass-card p-4 space-y-3">
          {/* Post controls */}
          <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border/60">
            <span className="text-xs text-muted-foreground">Post month</span>
            <input type="month" value={postMonth} onChange={e => setPostMonth(e.target.value)}
              className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button onClick={() => openPostModal(postMonth)} disabled={dueForPostMonth.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90 transition-colors disabled:opacity-50">
              {dueForPostMonth.length > 0 ? `Post ${dueForPostMonth.length} due for ${monthKeyLabel(postMonth)}` : `All posted for ${monthKeyLabel(postMonth)}`}
            </button>
          </div>

          {recurringExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring expenses yet. Add salaries, utilities, rent, or subscriptions so they post each month with one click.</p>
          ) : (
            <div className="space-y-1.5">
              {recurringExpenses.map(t => {
                const postedThisMonth = postedSet.has(`${t.id}|${postMonth}`);
                return (
                  <div key={t.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg transition-colors ${t.active ? 'hover:bg-muted/40' : 'opacity-55'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.active ? 'bg-success' : 'bg-muted-foreground'}`} title={t.active ? 'Active' : 'Paused'} />
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info flex-shrink-0">{t.category}</span>
                      <span className="text-sm font-medium text-foreground truncate">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">day {t.day_of_month}</span>
                      {t.active && (postedThisMonth
                        ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success flex-shrink-0 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> posted</span>
                        : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">due</span>)}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground">{formatPKR(t.amount)}</span>
                      <button onClick={() => handleToggleActive(t)} title={t.active ? 'Pause' : 'Resume'}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.active ? 'Pause' : 'Resume'}</button>
                      <button onClick={() => openRecurringEdit(t)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteRecurring(t)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Posting adds an editable expense for the chosen month. A template can only post once per month, so re-posting is safe.</p>
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

      {/* ── Add / edit recurring modal ── */}
      {recurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{recurringModal.mode === 'add' ? 'Add Recurring Expense' : 'Edit Recurring Expense'}</h2>
              <button onClick={() => setRecurringModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveRecurring} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Label</label>
                <input value={recurringForm.label} onChange={e => setRecurringForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Office Salaries, Electricity, Office Rent" className={inputCls} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                  <select value={recurringForm.category} onChange={e => setRecurringForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className={inputCls}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Default amount (PKR)</label>
                  <input type="number" min="1" step="0.01" value={recurringForm.amount} onChange={e => setRecurringForm(p => ({ ...p, amount: e.target.value }))} className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Day of month</label>
                  <input type="number" min="1" max="28" value={recurringForm.day_of_month} onChange={e => setRecurringForm(p => ({ ...p, day_of_month: e.target.value }))} className={inputCls} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">1–28 · the date posted expenses carry</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Start month (optional)</label>
                  <input type="month" value={recurringForm.start_month} onChange={e => setRecurringForm(p => ({ ...p, start_month: e.target.value }))} className={inputCls} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Blank = due from any month</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
                <input value={recurringForm.notes} onChange={e => setRecurringForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRecurringModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">{recurringModal.mode === 'add' ? 'Add' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Post recurring modal ── */}
      {postModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="modal-card max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Post recurring — {monthKeyLabel(postModal.period)}</h2>
              <button onClick={() => setPostModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Review amounts (adjust variable bills like utilities), then post. Each becomes an editable expense; already-posted items are skipped automatically.</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
              {dueForMonth(postModal.period).map(t => {
                const d = postDrafts[t.id] ?? { checked: true, amount: String(t.amount) };
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <input type="checkbox" checked={d.checked} onChange={e => setPostDrafts(p => ({ ...p, [t.id]: { ...d, checked: e.target.checked } }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 flex-shrink-0" />
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info flex-shrink-0">{t.category}</span>
                    <span className="text-sm text-foreground truncate flex-1 min-w-0">{t.label}</span>
                    <input type="number" min="0" step="0.01" value={d.amount} onChange={e => setPostDrafts(p => ({ ...p, [t.id]: { ...d, amount: e.target.value } }))}
                      className="w-32 px-2 py-1 bg-muted border border-border rounded text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
              <span className="text-sm text-muted-foreground">Total to post</span>
              <span className="text-base font-bold text-foreground">
                {formatPKR(Object.values(postDrafts).filter(d => d.checked).reduce((s, d) => s + (Number(d.amount) || 0), 0))}
              </span>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setPostModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button type="button" onClick={handlePostRecurring} disabled={posting} className="flex-1 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-60">{posting ? 'Posting…' : 'Post to ledger'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
