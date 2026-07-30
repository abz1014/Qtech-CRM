import { useState } from 'react';
import { toast } from 'sonner';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useFinanceReporting, categoryColor, monthKeyLabel, postedKey } from '@/hooks/useFinanceReporting';
import { useFinanceRange } from './FinanceLayout';
import { formatPKR, formatDate } from '@/lib/format';
import { businessToday } from '@/lib/dates';
import { generateCSV, downloadCSV } from '@/lib/csvExport';
import {
  Receipt, X, Plus, Repeat, Pencil, Trash2, PieChart, CheckCircle, Download,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { RecurringExpense, Expense } from '@/types/bookkeeping';

export default function FinanceExpensesPage() {
  const { range, rangeLabel, isAllTime } = useFinanceRange();
  const {
    addExpense, deleteExpense,
    addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, postRecurringExpenses,
    getClientName,
  } = useCRM();
  const { user, isAdmin } = useAuth();
  const confirm = useConfirm();
  const f = useFinanceReporting(range, isAllTime);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: businessToday(), amount: '', category: 'Inventory/Procurement' as string, description: '', order_id: '' });

  const [recurringModal, setRecurringModal] = useState<{ mode: 'add' | 'edit'; template?: RecurringExpense } | null>(null);
  const [recurringForm, setRecurringForm] = useState({ label: '', category: 'Salaries' as string, amount: '', day_of_month: '1', start_month: '', notes: '' });
  const [postMonth, setPostMonth] = useState(() => businessToday().slice(0, 7));
  const [postModal, setPostModal] = useState<{ period: string } | null>(null);
  const [postDrafts, setPostDrafts] = useState<Record<string, { checked: boolean; amount: string }>>({});
  const [posting, setPosting] = useState(false);

  if (f.loading) return <TableSkeleton rows={8} />;

  const dueForPostMonth = f.dueForMonth(postMonth);

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

  const handleDeleteExpense = async (e: Expense) => {
    if (!(await confirm({ title: 'Delete expense?', message: `Delete this expense — ${e.category} ${formatPKR(e.amount)}${e.description ? ` (${e.description})` : ''}? This cannot be undone.`, confirmLabel: 'Delete' }))) return;
    try {
      await deleteExpense(e.expense_id);
      toast.success('Expense deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete expense');
    }
  };

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
    if (!(await confirm({ title: 'Delete recurring expense?', message: `Delete recurring expense "${t.label}"? Already-posted months stay in the ledger.`, confirmLabel: 'Delete' }))) return;
    try {
      await deleteRecurringExpense(t.id);
      toast.success('Recurring expense deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const openPostModal = (period: string) => {
    const due = f.dueForMonth(period);
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
    rows.push(['EXPENSES', 'Date', 'Category', 'Description', 'Amount']);
    f.rangeExpenses.forEach(e => rows.push([e.date, e.category, e.description, e.amount]));
    rows.push([]);
    rows.push(['SPEND BY CATEGORY', 'Amount', '% of expenses']);
    f.spendByCategory.rows.forEach(r => rows.push([r.category, r.amount, `${r.pct.toFixed(1)}%`]));
    downloadCSV(generateCSV([`Q-Tech Expenses (generated ${businessToday()})`], rows), `Expenses_${businessToday()}.csv`);
  };

  const inputCls = 'w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="space-y-8">
      <datalist id="expense-cats">{f.allCategories.map(c => <option key={c} value={c} />)}</datalist>

      {/* ── Expenses ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="section-title flex items-center gap-1.5"><Receipt className="w-4 h-4 text-info" /> Expenses · {rangeLabel}</p>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        </div>
        <div className="glass-card p-4">
          {f.rangeExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No expenses recorded in this period.</p>
          ) : (
            <div className="space-y-1.5">
              {f.rangeExpenses.slice(0, 15).map(e => (
                <div key={e.expense_id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: categoryColor(e.category), background: categoryColor(e.category).replace(/\)$/, ' / 0.14)') }}>{e.category}</span>
                    <span className="text-sm text-foreground truncate">{e.description || '—'}</span>
                    {e.recurring_id && <span className="text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5" title="Posted from a recurring template"><Repeat className="w-3 h-3" /> recurring</span>}
                    {e.order_id && <span className="text-[11px] text-muted-foreground flex-shrink-0">↳ {getClientName(f.orders.find(o => o.id === e.order_id)?.client_id ?? '')}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{formatPKR(e.amount)}</span>
                    {isAdmin && (
                      <button onClick={() => handleDeleteExpense(e)} title="Delete expense"
                        className="text-muted-foreground/60 hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {f.rangeExpenses.length > 15 && <p className="text-xs text-muted-foreground pt-1">…and {f.rangeExpenses.length - 15} more in this period (full list in CSV export)</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Spend by Category ── */}
      <div>
        <p className="section-title mb-3 flex items-center gap-1.5"><PieChart className="w-4 h-4 text-info" /> Spend by Category <span className="text-xs font-normal text-muted-foreground">· {formatPKR(f.spendByCategory.total)} in this period</span></p>
        <div className="glass-card p-4">
          {f.spendByCategory.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No expenses to break down in this period.</p>
          ) : (
            <>
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-4 gap-px">
                {f.spendByCategory.rows.map(r => (
                  r.pct > 0 ? <div key={r.category} style={{ width: `${r.pct}%`, background: categoryColor(r.category) }} title={`${r.category}: ${r.pct.toFixed(1)}%`} /> : null
                ))}
              </div>
              <div className="space-y-2.5">
                {f.spendByCategory.rows.map(r => (
                  <div key={r.category} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: categoryColor(r.category) }} />
                    <span className="text-sm text-foreground w-44 flex-shrink-0 truncate">{r.category}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full opacity-80" style={{ width: `${r.pct}%`, background: categoryColor(r.category) }} />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-28 text-right flex-shrink-0 tabular-nums">{formatPKR(r.amount)}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0 tabular-nums">{r.pct.toFixed(1)}%</span>
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
            {f.recurringMonthlyTotal > 0 && <span className="text-xs font-normal text-muted-foreground">· {formatPKR(f.recurringMonthlyTotal)}/mo active</span>}
          </p>
          <button onClick={openRecurringAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Recurring
          </button>
        </div>
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border/60">
            <span className="text-xs text-muted-foreground">Post month</span>
            <input type="month" value={postMonth} onChange={e => setPostMonth(e.target.value)}
              className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button onClick={() => openPostModal(postMonth)} disabled={dueForPostMonth.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90 transition-colors disabled:opacity-50">
              {dueForPostMonth.length > 0 ? `Post ${dueForPostMonth.length} due for ${monthKeyLabel(postMonth)}` : `All posted for ${monthKeyLabel(postMonth)}`}
            </button>
          </div>

          {f.recurringExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring expenses yet. Add salaries, utilities, rent, or subscriptions so they post each month with one click.</p>
          ) : (
            <div className="space-y-1.5">
              {f.recurringExpenses.map(t => {
                const postedThisMonth = f.postedSet.has(postedKey(t.id, postMonth));
                return (
                  <div key={t.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg transition-colors ${t.active ? 'hover:bg-muted/40' : 'opacity-55'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.active ? 'bg-success' : 'bg-muted-foreground'}`} title={t.active ? 'Active' : 'Paused'} />
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info flex-shrink-0">{t.category}</span>
                      <span className="text-sm font-medium text-foreground truncate">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">day {t.day_of_month}</span>
                      {t.active && (postedThisMonth
                        ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success flex-shrink-0 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> posted</span>
                        : <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">due</span>)}
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
          <p className="text-[12px] text-muted-foreground">Posting adds an editable expense for the chosen month. A template can only post once per month, so re-posting is safe.</p>
        </div>
      </div>

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
                <label className="block text-sm font-medium text-foreground mb-1">Category / group</label>
                <input list="expense-cats" value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className={inputCls} placeholder="Pick a group or type a new one" required />
                <p className="text-[11px] text-muted-foreground mt-0.5">Type any name to create a new expense group.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Customs clearing — Karachi port" className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Link to order (optional)</label>
                <select value={expenseForm.order_id} onChange={e => setExpenseForm(p => ({ ...p, order_id: e.target.value }))} className={inputCls}>
                  <option value="">— General expense —</option>
                  {f.orders.map(o => (
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
                  <label className="block text-sm font-medium text-foreground mb-1">Category / group</label>
                  <input list="expense-cats" value={recurringForm.category} onChange={e => setRecurringForm(p => ({ ...p, category: e.target.value }))} className={inputCls} placeholder="Pick or type a new group" required />
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
                  <p className="text-[11px] text-muted-foreground mt-0.5">1–28 · the date posted expenses carry</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Start month (optional)</label>
                  <input type="month" value={recurringForm.start_month} onChange={e => setRecurringForm(p => ({ ...p, start_month: e.target.value }))} className={inputCls} />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Blank = due from any month</p>
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
              {f.dueForMonth(postModal.period).map(t => {
                const d = postDrafts[t.id] ?? { checked: true, amount: String(t.amount) };
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <input type="checkbox" checked={d.checked} onChange={e => setPostDrafts(p => ({ ...p, [t.id]: { ...d, checked: e.target.checked } }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 flex-shrink-0" />
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info flex-shrink-0">{t.category}</span>
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
