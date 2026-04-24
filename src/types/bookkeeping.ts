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
  category: ExpenseCategory;
  description: string;
  vendor_id: string | null;
  rfq_id: string | null;
  order_id: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  notes: string | null;
}

export interface CreateExpenseInput {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  vendor_id?: string | null;
  rfq_id?: string | null;
  order_id?: string | null;
  notes?: string;
}

export interface UpdateExpenseInput extends Partial<CreateExpenseInput> {}

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
