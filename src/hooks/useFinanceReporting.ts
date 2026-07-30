import { useMemo, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { useSupplierPayments } from '@/hooks/useSupplierPayments';
import { useExpenses } from '@/hooks/useExpenses';
import { useRecurringExpenses } from '@/hooks/useRecurringExpenses';
import { useGstInvoices } from '@/hooks/useGstInvoices';
import { computeReconciliationExceptions } from '@/lib/finance/reconciliation';
import { buildPostedSet, dueRecurringForMonth, postedKey } from '@/lib/finance/recurring';
import { businessToday } from '@/lib/dates';
import type { ExpenseCategory, RecurringExpense } from '@/types/bookkeeping';

export { postedKey };

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Inventory/Procurement', 'Travel', 'Equipment', 'Office Expenses',
  'Salaries', 'Software Subscriptions', 'Utilities', 'Marketing', 'Misc',
];

// Stable colour per category (CSS value, so custom groups get a colour too).
const CATEGORY_HUES: Record<string, string> = {
  'Salaries':               'hsl(158 60% 42%)',
  'Inventory/Procurement':  'hsl(214 100% 60%)',
  'Utilities':              'hsl(35 92% 52%)',
  'Travel':                 'hsl(190 70% 45%)',
  'Equipment':              'hsl(265 60% 60%)',
  'Office Expenses':        'hsl(158 40% 55%)',
  'Software Subscriptions': 'hsl(320 60% 58%)',
  'Marketing':              'hsl(22 90% 56%)',
  'Misc':                   'hsl(218 14% 52%)',
};
export function categoryColor(cat: string): string {
  if (CATEGORY_HUES[cat]) return CATEGORY_HUES[cat];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 56%)`;
}

export const currentMonthKey = () => businessToday().slice(0, 7); // YYYY-MM
export const monthKeyLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
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

export interface FinanceRange { from: string; to: string; }

/**
 * All Finance-section business logic in one place (T1-5): every page under
 * /finance calls this with the shared date range from FinanceLayout and
 * destructures only what it needs. Cheap to compute per-mount given the data
 * size, so no cross-page memo sharing is needed -- only one Finance page is
 * mounted at a time via routing.
 */
export function useFinanceReporting(range: FinanceRange, isAllTime: boolean) {
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: orderPayments = [], isLoading: orderPaymentsLoading } = useOrderPayments();
  const { data: supplierPayments = [], isLoading: supplierPaymentsLoading } = useSupplierPayments();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: recurringExpenses = [], isLoading: recurringExpensesLoading } = useRecurringExpenses();
  const { data: gstInvoices = [], isLoading: gstInvoicesLoading } = useGstInvoices();

  const loading = ordersLoading || orderPaymentsLoading || supplierPaymentsLoading
    || expensesLoading || recurringExpensesLoading || gstInvoicesLoading;

  const todayStr = businessToday();

  // ── Per-order payment totals ──────────────────────────────────────────────
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

  // ── KPIs for the selected range (orders by PO date) ───────────────────────
  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = o.customer_po_date || o.confirmed_date;
      if (!d) return isAllTime;
      return d >= range.from && d <= range.to;
    }),
  [orders, range, isAllTime]);

  const rangeExpenses = useMemo(
    () => expenses.filter(e => e.date >= range.from && e.date <= range.to),
    [expenses, range]);

  const revenue = filteredOrders.reduce((s, o) => s + (o.order_value || 0), 0);
  const cost    = filteredOrders.reduce((s, o) => s + (o.cost_value  || 0), 0);
  const expensesTotal = rangeExpenses.reduce((s, e) => s + e.amount, 0);
  const profit  = revenue - cost - expensesTotal;
  const margin  = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

  // ── Spend by category (selected range) ────────────────────────────────────
  const spendByCategory = useMemo(() => {
    const m = new Map<string, number>();
    rangeExpenses.forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    const total = [...m.values()].reduce((s, v) => s + v, 0);
    return {
      total,
      rows: [...m.entries()]
        .map(([category, amount]) => ({ category, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [rangeExpenses]);

  // ── Recurring: which templates are already posted, and which are due ─────
  const postedSet = useMemo(() => buildPostedSet(expenses), [expenses]);
  const dueForMonth = useCallback((period: string): RecurringExpense[] =>
    dueRecurringForMonth(recurringExpenses, postedSet, period),
  [recurringExpenses, postedSet]);
  const currentMonth = currentMonthKey();
  const dueThisMonth = useMemo(() => dueForMonth(currentMonth), [dueForMonth, currentMonth]);
  const recurringMonthlyTotal = useMemo(
    () => recurringExpenses.filter(t => t.active).reduce((s, t) => s + t.amount, 0),
    [recurringExpenses]);

  // Built-in categories + any custom groups already used → datalist suggestions.
  const allCategories = useMemo(() => {
    const set = new Set<string>(EXPENSE_CATEGORIES);
    expenses.forEach(e => { if (e.category) set.add(e.category); });
    recurringExpenses.forEach(t => { if (t.category) set.add(t.category); });
    return [...set].sort();
  }, [expenses, recurringExpenses]);

  // ── Receivables: any order not fully paid by the customer ────────────────
  const receivables = useMemo(() =>
    orders
      .filter(o => o.status !== 'payment_received')
      .map(o => {
        const paid = paidInByOrder.get(o.id) ?? 0;
        return { o, paid, balance: o.order_value - paid };
      })
      .filter(r => Math.round(r.balance * 100) > 0)
      .sort((a, b) => {
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

  // ── Reconciliation exceptions (order/payments/GST cross-checks) ──────────
  const exceptions = useMemo(
    () => computeReconciliationExceptions(orders, orderPayments, supplierPayments, gstInvoices),
    [orders, orderPayments, supplierPayments, gstInvoices]);
  const criticalCount = exceptions.filter(e => e.severity === 'critical').length;
  const warningCount = exceptions.filter(e => e.severity === 'warning').length;

  // ── Cash flow + P&L by month (within range) ───────────────────────────────
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
  const cashRunning = cashflow.length ? cashflow[cashflow.length - 1].running : 0;
  const maxNetFlow = Math.max(1, ...cashflow.map(r => Math.abs(r.net)));

  const pnl = useMemo(() => months.map(k => {
    const mo = orders.filter(o => (o.customer_po_date || o.confirmed_date || '').startsWith(k));
    const rev = mo.reduce((s, o) => s + (o.order_value || 0), 0);
    const cst = mo.reduce((s, o) => s + (o.cost_value || 0), 0);
    const exp = expenses.filter(e => e.date.startsWith(k)).reduce((s, e) => s + e.amount, 0);
    return { key: k, revenue: rev, cost: cst, expenses: exp, net: rev - cst - exp };
  }), [months, orders, expenses]);

  return {
    loading,
    orders, orderPayments, supplierPayments, expenses, recurringExpenses, gstInvoices,
    todayStr, paidInByOrder, paidOutByOrder,
    filteredOrders, rangeExpenses, revenue, cost, expensesTotal, profit, margin,
    spendByCategory, postedSet, dueForMonth, dueThisMonth, recurringMonthlyTotal, allCategories,
    receivables, receivableTotal, overdueList, overdueTotal,
    exceptions, criticalCount, warningCount,
    months, cashflow, cashRunning, maxNetFlow, pnl,
  };
}
