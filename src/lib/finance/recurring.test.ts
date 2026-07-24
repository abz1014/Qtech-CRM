import { describe, it, expect } from 'vitest';
import { postedKey, buildPostedSet, dueRecurringForMonth } from './recurring';
import type { Expense, RecurringExpense } from '@/types/bookkeeping';

const tmpl = (over: Partial<RecurringExpense>): RecurringExpense => ({
  id: 't1', label: 'Salaries', category: 'Salaries', amount: 100, day_of_month: 1,
  active: true, start_month: '', notes: null, created_by: null, created_at: '', ...over,
});

const exp = (recurring_id: string | null, period: string | null): Expense => ({
  expense_id: `e-${recurring_id}-${period}`, date: '', amount: 0, category: 'Salaries',
  description: '', vendor_id: null, rfq_id: null, order_id: null, created_by: '',
  created_at: '', updated_by: null, updated_at: null, notes: null, recurring_id, period,
});

describe('recurring expense due logic', () => {
  it('buildPostedSet ignores non-recurring expenses', () => {
    const set = buildPostedSet([exp('t1', '2026-07'), exp(null, null), exp('t2', null)]);
    expect(set.has(postedKey('t1', '2026-07'))).toBe(true);
    expect(set.size).toBe(1); // t2 has no period → excluded
  });

  it('active template with no start_month is due when not yet posted', () => {
    const due = dueRecurringForMonth([tmpl({})], new Set(), '2026-07');
    expect(due.map(t => t.id)).toEqual(['t1']);
  });

  it('paused template is never due', () => {
    const due = dueRecurringForMonth([tmpl({ active: false })], new Set(), '2026-07');
    expect(due).toHaveLength(0);
  });

  it('already-posted template is not due (idempotency guard)', () => {
    const posted = buildPostedSet([exp('t1', '2026-07')]);
    expect(dueRecurringForMonth([tmpl({})], posted, '2026-07')).toHaveLength(0);
    // still due for a different month
    expect(dueRecurringForMonth([tmpl({})], posted, '2026-08')).toHaveLength(1);
  });

  it('respects start_month: not due before it, due on/after', () => {
    const t = tmpl({ start_month: '2026-07' });
    expect(dueRecurringForMonth([t], new Set(), '2026-06')).toHaveLength(0);
    expect(dueRecurringForMonth([t], new Set(), '2026-07')).toHaveLength(1);
    expect(dueRecurringForMonth([t], new Set(), '2026-09')).toHaveLength(1);
  });

  it('mixes several templates correctly for one month', () => {
    const templates = [
      tmpl({ id: 'a' }),                                  // due
      tmpl({ id: 'b', active: false }),                   // paused
      tmpl({ id: 'c', start_month: '2026-08' }),          // future
      tmpl({ id: 'd' }),                                  // already posted
    ];
    const posted = buildPostedSet([exp('d', '2026-07')]);
    const due = dueRecurringForMonth(templates, posted, '2026-07').map(t => t.id);
    expect(due).toEqual(['a']);
  });
});
