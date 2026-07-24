import type { Expense, RecurringExpense } from '@/types/bookkeeping';

/** Stable key identifying a posted recurring instance (template × month). */
export const postedKey = (recurringId: string, period: string) => `${recurringId}|${period}`;

/** Set of (recurring_id|period) keys already present in the expense ledger. */
export function buildPostedSet(expenses: Expense[]): Set<string> {
  const s = new Set<string>();
  for (const e of expenses) {
    if (e.recurring_id && e.period) s.add(postedKey(e.recurring_id, e.period));
  }
  return s;
}

/**
 * Templates due to be posted for a YYYY-MM period: active, whose start_month is
 * blank or on/before the period, and not already posted for that month.
 * This is what drives the "N due" reminder and prevents double-posting.
 */
export function dueRecurringForMonth(
  templates: RecurringExpense[],
  posted: Set<string>,
  period: string,
): RecurringExpense[] {
  return templates.filter(t =>
    t.active &&
    (!t.start_month || t.start_month <= period) &&
    !posted.has(postedKey(t.id, period))
  );
}
