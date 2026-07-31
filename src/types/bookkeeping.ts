// Bookkeeping Module Types

export type InvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Partial';

export type ExpenseCategory =
  | 'Salaries'
  | 'Office Expenses'
  | 'Travel'
  | 'Equipment'
  | 'Software Subscriptions'
  | 'Utilities'
  | 'Marketing'
  | 'Inventory/Procurement'
  | 'Misc';

export type PaymentMethod =
  | 'Bank Transfer'
  | 'Check'
  | 'Cash'
  | 'Credit Card'
  | 'Online Payment';

export type PayableStatus = 'Pending' | 'Paid' | 'Overdue' | 'Partial';

export type BudgetType = 'Revenue' | 'Expense';

// ============================================
// INVOICE INTERFACE
// ============================================
export interface Invoice {
  invoice_id: string;
  invoice_number: string; // e.g., "INV-2026-001"
  client_id: string;
  order_id: string | null;
  rfq_id: string | null;
  invoice_amount: number;
  issued_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  payment_status: InvoiceStatus;
  amount_paid: number;
  payment_method: string | null;
  created_by: string;
  created_at: string; // ISO timestamp
  updated_by: string | null;
  updated_at: string | null;
  notes: string | null;
}

// For creating/updating invoices
export interface CreateInvoiceInput {
  invoice_number: string;
  client_id: string;
  order_id?: string | null;
  rfq_id?: string | null;
  invoice_amount: number;
  issued_date: string;
  due_date: string;
  payment_method?: string | null;
  notes?: string;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  payment_status?: InvoiceStatus;
  amount_paid?: number;
}

// ============================================
// EXPENSE INTERFACE
// ============================================
export interface Expense {
  expense_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string; // a built-in ExpenseCategory or a custom group the user added
  description: string;
  vendor_id: string | null;
  rfq_id: string | null;
  order_id: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  notes: string | null;
  recurring_id?: string | null; // template this instance came from (if any)
  period?: string | null;       // YYYY-MM this recurring instance covers
}

export interface CreateExpenseInput {
  date: string;
  amount: number;
  category: string; // a built-in ExpenseCategory or a custom group the user added
  description: string;
  vendor_id?: string | null;
  rfq_id?: string | null;
  order_id?: string | null;
  notes?: string;
  recurring_id?: string | null;
  period?: string | null;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

// ── Recurring expense templates (salaries, utilities, …) ────────────────────

/** A monthly expense template; posted into `expenses` once per month. */
export interface RecurringExpense {
  id: string;
  label: string;
  category: string; // a built-in ExpenseCategory or a custom group the user added
  amount: number;
  day_of_month: number;   // 1–28: the day the posted expense is dated
  active: boolean;
  start_month: string;    // YYYY-MM; '' = due from the beginning
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateRecurringExpenseInput {
  label: string;
  category: string; // a built-in ExpenseCategory or a custom group the user added
  amount: number;
  day_of_month?: number;
  active?: boolean;
  start_month?: string;
  notes?: string | null;
}

export type UpdateRecurringExpenseInput = Partial<CreateRecurringExpenseInput>;

// ── GST Invoice Register ────────────────────────────────────────────────────

/** FBR sales-tax filing stage (set manually by the accountant). */
export type FbrStatus = 'Pending' | 'Generated' | 'Fully Generated' | 'Receipt Received' | 'Deposited';

export const FBR_STATUSES: FbrStatus[] = ['Pending', 'Generated', 'Fully Generated', 'Receipt Received', 'Deposited'];

/** One GST sales-tax invoice + its TCS/FBR lifecycle. Optionally linked to an order. */
export interface GstInvoice {
  id: string;
  order_id: string | null;

  // identity
  gst_invoice_number: string;
  invoice_date: string;        // YYYY-MM-DD
  client_name: string;
  supplier_company: string;
  customer_po_number: string;
  item_name: string;
  item_number: string;
  product_detail: string;
  delivery_challan_number: string;
  amount: number;
  gst_amount: number;

  // TCS courier tracking
  received_date: string;
  tcs_sent_date: string;
  tcs_receipt_number: string;
  tcs_receipt_date: string;
  client_received_date: string;

  // FBR filing
  fbr_status: FbrStatus;
  wasif_receipt_received: boolean;
  wasif_receipt_date: string;
  // Path within the `gst-receipts` Storage bucket, not the file itself --
  // optional so the main edit form (which never touches this field) doesn't
  // have to carry it; the upload/delete flow sets it directly via a scoped
  // updateGstInvoice() call. Absent from an update payload leaves the
  // existing value untouched (Supabase only writes keys you actually send).
  wasif_receipt_file_path?: string | null;
  psid: string;
  tax_deposit_date: string;
  tax_deposit_amount: number;
  tax_deposit_bank: string;

  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export type CreateGstInvoiceInput = Omit<GstInvoice, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateGstInvoiceInput = Partial<CreateGstInvoiceInput>;

// ============================================
// PAYMENT RECORD INTERFACE
// ============================================
export interface PaymentRecord {
  payment_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string;
}

// ============================================
// PAYABLE INTERFACE (Phase 2)
// ============================================
export interface Payable {
  payable_id: string;
  vendor_id: string;
  amount: number;
  due_date: string;
  payment_status: PayableStatus;
  amount_paid: number;
  payment_date: string | null;
  linked_expense_id: string | null;
  invoice_reference: string | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

export interface CreatePayableInput {
  vendor_id: string;
  amount: number;
  due_date: string;
  payment_date?: string | null;
  linked_expense_id?: string | null;
  invoice_reference?: string;
  payment_method?: string;
}

export interface UpdatePayableInput extends Partial<CreatePayableInput> {
  payment_status?: PayableStatus;
  amount_paid?: number;
}

export interface CreatePayablePaymentInput {
  payable_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

// ============================================
// BUDGET INTERFACE (Phase 3)
// ============================================
export interface Budget {
  budget_id: string;
  period: string; // YYYY-MM-01 (first day of month)
  budget_type: BudgetType;
  category: string | null;
  expected_amount: number;
  created_by: string;
  created_at: string;
}

// ============================================
// SUMMARY / REPORTING INTERFACES
// ============================================

export interface MonthlySummary {
  month: string; // YYYY-MM
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  invoice_count: number;
  expense_count: number;
}

export interface QuarterlySummary {
  quarter: string; // Q1 2026, Q2 2026, etc.
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  margin_percent: number;
}

export interface ProjectProfitability {
  rfq_id: string;
  rfq_number?: string;
  client_name: string;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  margin_percent: number;
  invoice_count: number;
  expense_count: number;
}

export interface CashflowMonth {
  month: string; // YYYY-MM
  opening_balance: number;
  total_inflow: number;
  total_outflow: number;
  closing_balance: number;
}

export interface ARAgingBucket {
  bucket: string; // "0-30 days", "30-60 days", "60+ days", "Not yet due"
  count: number;
  total_amount: number;
  invoices: Invoice[];
}

// ── Audit log (T2-6) ────────────────────────────────────────────────────────

// Lowercase to match audit_log's CHECK constraint (audit_log_action_check),
// confirmed live -- not the uppercase Postgres TG_OP values.
export type AuditAction = 'insert' | 'update' | 'delete';

/** One row written by a Postgres trigger on a financial/GST table (append-only). */
export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  changed_by: string | null;
  changed_at: string; // ISO timestamp
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}

export interface DashboardMetrics {
  mtd_revenue: number;
  mtd_expenses: number;
  mtd_profit: number;
  ytd_revenue: number;
  ytd_expenses: number;
  ytd_profit: number;
  outstanding_ar: number;
  outstanding_ap: number;
  overdue_invoices_count: number;
  overdue_invoices_amount: number;
}
