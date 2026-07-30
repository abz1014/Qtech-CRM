import { describe, it, expect } from 'vitest';
import { computeReconciliationExceptions } from './reconciliation';
import type { Order, OrderPayment, SupplierPayment } from '@/types/crm';
import type { GstInvoice } from '@/types/bookkeeping';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1', client_id: 'c1', vendor_id: 'v1', sales_person_id: 's1',
    product_type: 'Widget', order_value: 100000, cost_value: 60000,
    status: 'confirmed', notes: '', confirmed_date: '2026-07-01', rfq_id: null,
    customer_po_number: null, customer_po_date: '2026-06-25',
    payment_terms_days: 30, delivery_date: '2026-07-10', payment_due_date: '2026-08-10',
    ...overrides,
  } as Order;
}

function makeGst(overrides: Partial<GstInvoice> = {}): GstInvoice {
  return {
    id: 'g1', order_id: 'o1', gst_invoice_number: 'GST-1', invoice_date: '2026-07-01',
    client_name: 'ACME', supplier_company: 'Sup', customer_po_number: 'PO1',
    item_name: 'Item', item_number: '1', product_detail: '', delivery_challan_number: 'DC1',
    amount: 118000, gst_amount: 18000,
    received_date: '2026-07-01', tcs_sent_date: '2026-07-02', tcs_receipt_number: '',
    tcs_receipt_date: '2026-07-03', client_received_date: '2026-07-04',
    fbr_status: 'Pending', wasif_receipt_received: false, wasif_receipt_date: '',
    psid: '', tax_deposit_date: '', tax_deposit_amount: 0, tax_deposit_bank: '',
    notes: null, created_by: null, created_at: '2026-07-01T00:00:00Z', updated_at: null,
    ...overrides,
  } as GstInvoice;
}

describe('computeReconciliationExceptions', () => {
  it('finds nothing wrong with clean data', () => {
    const orders = [makeOrder()];
    const exceptions = computeReconciliationExceptions(orders, [], [], [makeGst()]);
    expect(exceptions).toEqual([]);
  });

  it('flags customer payments exceeding order value', () => {
    const orders = [makeOrder({ order_value: 1000 })];
    const payments: OrderPayment[] = [
      { id: 'p1', order_id: 'o1', amount: 700, payment_date: '2026-07-05', payment_method: '', reference: '', notes: '', recorded_by: null },
      { id: 'p2', order_id: 'o1', amount: 500, payment_date: '2026-07-06', payment_method: '', reference: '', notes: '', recorded_by: null },
    ];
    const exceptions = computeReconciliationExceptions(orders, payments, [], []);
    expect(exceptions.some(e => e.category === 'Payments exceed total' && e.orderId === 'o1')).toBe(true);
  });

  it('flags supplier payments exceeding cost value', () => {
    const orders = [makeOrder({ cost_value: 1000 })];
    const payments: SupplierPayment[] = [
      { id: 'p1', order_id: 'o1', amount: 1500, payment_date: '2026-07-05', payment_method: '', reference: '', notes: '', recorded_by: null },
    ];
    const exceptions = computeReconciliationExceptions(orders, [], payments, []);
    expect(exceptions.some(e => e.category === 'Payments exceed total')).toBe(true);
  });

  it('does not flag payments within tolerance of the total', () => {
    const orders = [makeOrder({ order_value: 1000 })];
    const payments: OrderPayment[] = [
      { id: 'p1', order_id: 'o1', amount: 1000.5, payment_date: '2026-07-05', payment_method: '', reference: '', notes: '', recorded_by: null },
    ];
    const exceptions = computeReconciliationExceptions(orders, payments, [], []);
    expect(exceptions).toEqual([]);
  });

  it('flags negative order values', () => {
    const orders = [makeOrder({ order_value: -500 })];
    const exceptions = computeReconciliationExceptions(orders, [], [], []);
    expect(exceptions.some(e => e.severity === 'critical' && e.message.includes('negative'))).toBe(true);
  });

  it('flags GST portion exceeding order value', () => {
    const orders = [makeOrder({ order_value: 1000, order_gst_amount: 1500 })];
    const exceptions = computeReconciliationExceptions(orders, [], [], []);
    expect(exceptions.some(e => e.message.includes("GST portion"))).toBe(true);
  });

  it('flags a customer PO date after the confirmed date', () => {
    const orders = [makeOrder({ customer_po_date: '2026-07-15', confirmed_date: '2026-07-01' })];
    const exceptions = computeReconciliationExceptions(orders, [], [], []);
    expect(exceptions.some(e => e.category === 'Dates out of sequence' && e.message.includes('PO date'))).toBe(true);
  });

  it('flags delivery before the order was confirmed', () => {
    const orders = [makeOrder({ confirmed_date: '2026-07-10', delivery_date: '2026-07-01' })];
    const exceptions = computeReconciliationExceptions(orders, [], [], []);
    expect(exceptions.some(e => e.message.includes('before the order was confirmed'))).toBe(true);
  });

  it('flags a payment recorded before the order was confirmed', () => {
    const orders = [makeOrder({ confirmed_date: '2026-07-10' })];
    const payments: OrderPayment[] = [
      { id: 'p1', order_id: 'o1', amount: 100, payment_date: '2026-07-01', payment_method: '', reference: '', notes: '', recorded_by: null },
    ];
    const exceptions = computeReconciliationExceptions(orders, payments, [], []);
    expect(exceptions.some(e => e.message.includes('recorded before the order was confirmed'))).toBe(true);
  });

  it('flags a non-positive payment amount', () => {
    const orders = [makeOrder()];
    const payments: OrderPayment[] = [
      { id: 'p1', order_id: 'o1', amount: 0, payment_date: '2026-07-05', payment_method: '', reference: '', notes: '', recorded_by: null },
    ];
    const exceptions = computeReconciliationExceptions(orders, payments, [], []);
    expect(exceptions.some(e => e.message.includes('not positive'))).toBe(true);
  });

  it('flags a GST amount that is not ~18% of net', () => {
    const gst = [makeGst({ amount: 118000, gst_amount: 30000 })]; // way more than 18%
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.category === 'GST ≠ 18% of net')).toBe(true);
  });

  it('does not flag a GST amount within tolerance of 18%', () => {
    const gst = [makeGst({ amount: 118000, gst_amount: 18000 })]; // exactly 18% of 100000 net
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.category === 'GST ≠ 18% of net')).toBe(false);
  });

  it('flags a GST invoice referencing an order that no longer exists', () => {
    const gst = [makeGst({ order_id: 'missing-order' })];
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.category === 'No matching order')).toBe(true);
  });

  it('does not flag a GST invoice with no order link at all', () => {
    const gst = [makeGst({ order_id: null })];
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.category === 'No matching order')).toBe(false);
  });

  it('flags the TCS courier trail moving backwards in time', () => {
    const gst = [makeGst({ tcs_sent_date: '2026-07-10', tcs_receipt_date: '2026-07-05' })];
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.category === 'Dates out of sequence' && e.gstInvoiceId === 'g1')).toBe(true);
  });

  it('flags a tax deposit dated before the invoice itself', () => {
    const gst = [makeGst({ invoice_date: '2026-07-10', tax_deposit_date: '2026-07-01' })];
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.message.includes('Tax deposit date'))).toBe(true);
  });

  it('flags a negative GST amount', () => {
    const gst = [makeGst({ amount: -100, gst_amount: -18 })];
    const exceptions = computeReconciliationExceptions([makeOrder()], [], [], gst);
    expect(exceptions.some(e => e.severity === 'critical' && e.message.includes('negative amount'))).toBe(true);
  });
});
