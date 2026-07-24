import { describe, it, expect } from 'vitest';
import { needsFbrAttention } from './fbr';

const NOW = '2026-07';

describe('GST FBR attention flag', () => {
  it('flags a prior-month invoice that is not deposited', () => {
    expect(needsFbrAttention({ fbr_status: 'Pending', invoice_date: '2026-05-10' }, NOW)).toBe(true);
    expect(needsFbrAttention({ fbr_status: 'Generated', invoice_date: '2026-06-30' }, NOW)).toBe(true);
    expect(needsFbrAttention({ fbr_status: 'Receipt Received', invoice_date: '2025-12-01' }, NOW)).toBe(true);
  });

  it('never flags a deposited invoice, however old', () => {
    expect(needsFbrAttention({ fbr_status: 'Deposited', invoice_date: '2024-01-01' }, NOW)).toBe(false);
  });

  it('does not flag the current month or the future (still within the filing window)', () => {
    expect(needsFbrAttention({ fbr_status: 'Pending', invoice_date: '2026-07-01' }, NOW)).toBe(false);
    expect(needsFbrAttention({ fbr_status: 'Pending', invoice_date: '2026-08-15' }, NOW)).toBe(false);
  });

  it('does not flag when there is no invoice date', () => {
    expect(needsFbrAttention({ fbr_status: 'Pending', invoice_date: '' }, NOW)).toBe(false);
  });
});
