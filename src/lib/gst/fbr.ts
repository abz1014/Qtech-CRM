import type { GstInvoice } from '@/types/bookkeeping';

/**
 * A GST invoice "needs attention" when its sales tax still isn't deposited and
 * its invoice month is earlier than the current month — i.e. a prior filing
 * period the accountant should have chased (WASIF receipt / PSID / deposit) by now.
 * Pure so it can be tested; the caller passes the current YYYY-MM.
 */
export function needsFbrAttention(
  g: Pick<GstInvoice, 'fbr_status' | 'invoice_date'>,
  currentMonthKey: string,
): boolean {
  if (g.fbr_status === 'Deposited') return false;
  const month = (g.invoice_date || '').slice(0, 7);
  if (!month) return false;
  return month < currentMonthKey;
}
