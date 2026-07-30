import type { Order, OrderPayment, SupplierPayment } from '@/types/crm';
import type { GstInvoice } from '@/types/bookkeeping';

export type ExceptionSeverity = 'critical' | 'warning';

export interface ReconciliationException {
  /** Stable key for React lists and dedup. */
  key: string;
  severity: ExceptionSeverity;
  category: string;
  message: string;
  /** Order this exception is about, if any — lets the UI link to /orders/:id. */
  orderId?: string;
  /** GST invoice id this exception is about, if any. */
  gstInvoiceId?: string;
}

const GST_RATE = 0.18;
const GST_TOLERANCE_PCT = 0.02; // 2% relative tolerance on the 18% check
const AMOUNT_TOLERANCE = 1; // rupees — absorbs rounding

function overpaid(paid: number, total: number): boolean {
  return paid - total > AMOUNT_TOLERANCE;
}

/**
 * Cross-checks the live financial data (orders, customer/supplier payments,
 * GST register) for the exception classes in the T2-5 backlog item.
 * Invoice/PaymentRecord/Payable are excluded — those tables are dead in the
 * live app (no page reads or writes them), so checking them would only ever
 * produce vacuous "0 rows" results.
 */
export function computeReconciliationExceptions(
  orders: Order[],
  orderPayments: OrderPayment[],
  supplierPayments: SupplierPayment[],
  gstInvoices: GstInvoice[],
): ReconciliationException[] {
  const exceptions: ReconciliationException[] = [];
  const ordersById = new Map(orders.map(o => [o.id, o]));

  const paidInByOrder = new Map<string, number>();
  orderPayments.forEach(p => paidInByOrder.set(p.order_id, (paidInByOrder.get(p.order_id) ?? 0) + p.amount));
  const paidOutByOrder = new Map<string, number>();
  supplierPayments.forEach(p => paidOutByOrder.set(p.order_id, (paidOutByOrder.get(p.order_id) ?? 0) + p.amount));

  // ── Orders: negative/impossible values, payment overages, date sequence ───
  for (const o of orders) {
    if (o.order_value < 0) {
      exceptions.push({ key: `order-neg-value-${o.id}`, severity: 'critical', category: 'Impossible value',
        message: `Order value is negative (${o.order_value})`, orderId: o.id });
    }
    if (o.cost_value < 0) {
      exceptions.push({ key: `order-neg-cost-${o.id}`, severity: 'critical', category: 'Impossible value',
        message: `Supplier cost is negative (${o.cost_value})`, orderId: o.id });
    }
    if (o.order_gst_amount != null && o.order_gst_amount > o.order_value + AMOUNT_TOLERANCE) {
      exceptions.push({ key: `order-gst-exceeds-value-${o.id}`, severity: 'critical', category: 'Impossible value',
        message: `Order's GST portion (${o.order_gst_amount}) exceeds its total value (${o.order_value})`, orderId: o.id });
    }

    const paidIn = paidInByOrder.get(o.id) ?? 0;
    if (overpaid(paidIn, o.order_value)) {
      exceptions.push({ key: `order-overpaid-in-${o.id}`, severity: 'critical', category: 'Payments exceed total',
        message: `Customer payments (${paidIn}) exceed order value (${o.order_value})`, orderId: o.id });
    }
    const paidOut = paidOutByOrder.get(o.id) ?? 0;
    if (overpaid(paidOut, o.cost_value)) {
      exceptions.push({ key: `order-overpaid-out-${o.id}`, severity: 'critical', category: 'Payments exceed total',
        message: `Supplier payments (${paidOut}) exceed order cost (${o.cost_value})`, orderId: o.id });
    }

    if (o.customer_po_date && o.confirmed_date && o.customer_po_date > o.confirmed_date) {
      exceptions.push({ key: `order-po-after-confirmed-${o.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Customer PO date (${o.customer_po_date}) is after the order's confirmed date (${o.confirmed_date})`, orderId: o.id });
    }
    if (o.confirmed_date && o.delivery_date && o.confirmed_date > o.delivery_date) {
      exceptions.push({ key: `order-confirmed-after-delivery-${o.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Delivery date (${o.delivery_date}) is before the order was confirmed (${o.confirmed_date})`, orderId: o.id });
    }
    if (o.delivery_date && o.payment_due_date && o.delivery_date > o.payment_due_date) {
      exceptions.push({ key: `order-due-before-delivery-${o.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Payment due date (${o.payment_due_date}) is before delivery (${o.delivery_date})`, orderId: o.id });
    }
  }

  // ── Payments: negative/zero amounts, payment recorded before order confirmed ─
  for (const p of orderPayments) {
    if (p.amount <= 0) {
      exceptions.push({ key: `orderpay-nonpositive-${p.id}`, severity: 'critical', category: 'Impossible value',
        message: `Customer payment amount is not positive (${p.amount})`, orderId: p.order_id });
    }
    const order = ordersById.get(p.order_id);
    if (order?.confirmed_date && p.payment_date < order.confirmed_date) {
      exceptions.push({ key: `orderpay-before-confirmed-${p.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Customer payment (${p.payment_date}) recorded before the order was confirmed (${order.confirmed_date})`, orderId: p.order_id });
    }
  }
  for (const p of supplierPayments) {
    if (p.amount <= 0) {
      exceptions.push({ key: `suppay-nonpositive-${p.id}`, severity: 'critical', category: 'Impossible value',
        message: `Supplier payment amount is not positive (${p.amount})`, orderId: p.order_id });
    }
    const order = ordersById.get(p.order_id);
    if (order?.confirmed_date && p.payment_date < order.confirmed_date) {
      exceptions.push({ key: `suppay-before-confirmed-${p.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Supplier payment (${p.payment_date}) recorded before the order was confirmed (${order.confirmed_date})`, orderId: p.order_id });
    }
  }

  // ── GST register: rate check, orphan order link, impossible values, filing dates ─
  for (const g of gstInvoices) {
    if (g.amount < 0 || g.gst_amount < 0) {
      exceptions.push({ key: `gst-negative-${g.id}`, severity: 'critical', category: 'Impossible value',
        message: `GST invoice has a negative amount (amount ${g.amount}, GST ${g.gst_amount})`, gstInvoiceId: g.id, orderId: g.order_id ?? undefined });
    }
    if (g.gst_amount > g.amount + AMOUNT_TOLERANCE) {
      exceptions.push({ key: `gst-exceeds-amount-${g.id}`, severity: 'critical', category: 'Impossible value',
        message: `GST portion (${g.gst_amount}) exceeds the invoice total (${g.amount})`, gstInvoiceId: g.id, orderId: g.order_id ?? undefined });
    } else {
      const net = g.amount - g.gst_amount;
      if (net > 0) {
        const expectedGst = net * GST_RATE;
        const relDiff = Math.abs(g.gst_amount - expectedGst) / expectedGst;
        if (relDiff > GST_TOLERANCE_PCT) {
          exceptions.push({ key: `gst-rate-mismatch-${g.id}`, severity: 'warning', category: 'GST ≠ 18% of net',
            message: `GST of ${g.gst_amount} is ${(relDiff * 100).toFixed(1)}% off the expected 18% of net (${expectedGst.toFixed(0)})`,
            gstInvoiceId: g.id, orderId: g.order_id ?? undefined });
        }
      }
    }

    if (g.order_id && !ordersById.has(g.order_id)) {
      exceptions.push({ key: `gst-orphan-order-${g.id}`, severity: 'critical', category: 'No matching order',
        message: `GST invoice references order ${g.order_id}, which no longer exists`, gstInvoiceId: g.id });
    }

    // TCS courier trail should move forward in time: received -> sent -> receipt -> client received.
    const trail: [string, string][] = [
      ['received_date', g.received_date], ['tcs_sent_date', g.tcs_sent_date],
      ['tcs_receipt_date', g.tcs_receipt_date], ['client_received_date', g.client_received_date],
    ];
    const filled = trail.filter(([, v]) => !!v);
    for (let i = 1; i < filled.length; i++) {
      if (filled[i - 1][1] > filled[i][1]) {
        exceptions.push({ key: `gst-trail-order-${g.id}-${i}`, severity: 'warning', category: 'Dates out of sequence',
          message: `${filled[i - 1][0]} (${filled[i - 1][1]}) is after ${filled[i][0]} (${filled[i][1]})`, gstInvoiceId: g.id, orderId: g.order_id ?? undefined });
      }
    }
    if (g.tax_deposit_date && g.invoice_date && g.tax_deposit_date < g.invoice_date) {
      exceptions.push({ key: `gst-deposit-before-invoice-${g.id}`, severity: 'warning', category: 'Dates out of sequence',
        message: `Tax deposit date (${g.tax_deposit_date}) is before the invoice date (${g.invoice_date})`, gstInvoiceId: g.id, orderId: g.order_id ?? undefined });
    }
  }

  return exceptions;
}
