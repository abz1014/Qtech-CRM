# Bookkeeping Module - Supabase Setup Guide

## 🗄️ STEP 1: Create Tables in Supabase

Run this SQL in your Supabase SQL Editor (SQL > New Query):

```sql
-- ============================================
-- TABLE 1: INVOICES (Revenue Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
  invoice_amount NUMERIC NOT NULL,
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'Pending',
  amount_paid NUMERIC DEFAULT 0,
  payment_method TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  notes TEXT,
  CONSTRAINT valid_amount CHECK (invoice_amount > 0),
  CONSTRAINT valid_paid CHECK (amount_paid >= 0 AND amount_paid <= invoice_amount),
  CONSTRAINT valid_status CHECK (payment_status IN ('Pending', 'Paid', 'Overdue', 'Partial'))
);

-- Indexes for performance
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_rfq_id ON invoices(rfq_id);
CREATE INDEX idx_invoices_issued_date ON invoices(issued_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_created_by ON invoices(created_by);

-- ============================================
-- TABLE 2: EXPENSES (Cost Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  notes TEXT,
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_category CHECK (category IN (
    'Salaries', 'Office Expenses', 'Travel', 'Equipment', 
    'Software Subscriptions', 'Utilities', 'Marketing', 
    'Inventory/Procurement', 'Misc'
  ))
);

-- Indexes for performance
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_vendor_id ON expenses(vendor_id);
CREATE INDEX idx_expenses_rfq_id ON expenses(rfq_id);
CREATE INDEX idx_expenses_order_id ON expenses(order_id);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

-- ============================================
-- TABLE 3: PAYMENT RECORDS (Detailed tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_records (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_amount CHECK (amount > 0)
);

CREATE INDEX idx_payment_records_invoice_id ON payment_records(invoice_id);
CREATE INDEX idx_payment_records_payment_date ON payment_records(payment_date);

-- ============================================
-- TABLE 4: PAYABLES (Optional - Phase 2)
-- ============================================
CREATE TABLE IF NOT EXISTS payables (
  payable_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'Pending',
  amount_paid NUMERIC DEFAULT 0,
  payment_date DATE,
  linked_expense_id UUID REFERENCES expenses(expense_id) ON DELETE SET NULL,
  invoice_reference TEXT,
  payment_method TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_paid CHECK (amount_paid >= 0 AND amount_paid <= amount)
);

CREATE INDEX idx_payables_vendor_id ON payables(vendor_id);
CREATE INDEX idx_payables_due_date ON payables(due_date);
CREATE INDEX idx_payables_payment_status ON payables(payment_status);

-- ============================================
-- TABLE 5: BUDGETS (Optional - Phase 3)
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period DATE NOT NULL,
  budget_type TEXT NOT NULL,
  category TEXT,
  expected_amount NUMERIC NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_amount CHECK (expected_amount > 0),
  CONSTRAINT valid_type CHECK (budget_type IN ('Revenue', 'Expense'))
);

CREATE INDEX idx_budgets_period ON budgets(period);
CREATE INDEX idx_budgets_category ON budgets(category);

GRANT SELECT ON invoices TO anon, authenticated;
GRANT INSERT ON invoices TO authenticated;
GRANT UPDATE ON invoices TO authenticated;
GRANT DELETE ON invoices TO authenticated;

GRANT SELECT ON expenses TO anon, authenticated;
GRANT INSERT ON expenses TO authenticated;
GRANT UPDATE ON expenses TO authenticated;
GRANT DELETE ON expenses TO authenticated;

GRANT SELECT ON payment_records TO anon, authenticated;
GRANT INSERT ON payment_records TO authenticated;

GRANT SELECT ON payables TO anon, authenticated;
GRANT INSERT ON payables TO authenticated;
GRANT UPDATE ON payables TO authenticated;
GRANT DELETE ON payables TO authenticated;

GRANT SELECT ON budgets TO anon, authenticated;
GRANT INSERT ON budgets TO authenticated;
GRANT UPDATE ON budgets TO authenticated;
GRANT DELETE ON budgets TO authenticated;
```

---

## ✅ CHECKLIST: After Running SQL

- [ ] Tables created successfully (check Table Editor sidebar)
- [ ] All 5 tables visible: `invoices`, `expenses`, `payment_records`, `payables`, `budgets`
- [ ] No errors in SQL output

---

## 📋 Quick Reference: Table Purposes

| Table | Purpose | Used In |
|-------|---------|---------|
| `invoices` | Track customer invoices + payments | Phase 1 |
| `expenses` | Track business expenses by category | Phase 1 |
| `payment_records` | Detailed payment history per invoice | Phase 1 |
| `payables` | Track vendor bills (Phase 2) | Phase 2 |
| `budgets` | Budget planning by month (Phase 3) | Phase 3 |

---

## 🔐 RLS Policies (Optional but Recommended)

Add Row-Level Security so only admins can access bookkeeping:

```sql
-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage invoices" ON invoices
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage expenses" ON expenses
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Others can only view
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (true);

CREATE POLICY "Users can view expenses" ON expenses
  FOR SELECT USING (true);
```

---

## 🎯 Next Steps

Once tables are created, I'll provide:
1. TypeScript types (`src/types/bookkeeping.ts`)
2. Context hooks (`src/contexts/CRMContext.tsx` updates)
3. React components (CRUD forms, tables, charts)
4. Main BookkeepingPage with tabs
5. Sidebar navigation update
