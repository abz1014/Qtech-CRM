-- ====================================================================
-- Bookkeeping Module Tables
-- Run this in Supabase SQL Editor to create all bookkeeping tables
-- ====================================================================

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  rfq_id          UUID,
  invoice_amount  NUMERIC NOT NULL DEFAULT 0,
  issued_date     TEXT NOT NULL DEFAULT '',
  due_date        TEXT NOT NULL DEFAULT '',
  payment_status  TEXT NOT NULL DEFAULT 'Pending'
                  CHECK (payment_status IN ('Pending','Paid','Overdue','Partial')),
  amount_paid     NUMERIC NOT NULL DEFAULT 0,
  payment_method  TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ,
  notes           TEXT
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  expense_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         TEXT NOT NULL DEFAULT '',
  amount       NUMERIC NOT NULL DEFAULT 0,
  category     TEXT NOT NULL DEFAULT 'Misc'
               CHECK (category IN (
                 'Salaries','Office Expenses','Travel','Equipment',
                 'Software Subscriptions','Utilities','Marketing',
                 'Inventory/Procurement','Misc'
               )),
  description  TEXT NOT NULL DEFAULT '',
  vendor_id    UUID REFERENCES vendors(id) ON DELETE SET NULL,
  rfq_id       UUID,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ,
  notes        TEXT
);

-- Payment records table (tracks individual payments against invoices)
CREATE TABLE IF NOT EXISTS payment_records (
  payment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL DEFAULT 0,
  payment_date   TEXT NOT NULL DEFAULT '',
  payment_method TEXT,
  notes          TEXT,
  recorded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payables table (amounts owed to vendors)
CREATE TABLE IF NOT EXISTS payables (
  payable_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID REFERENCES vendors(id) ON DELETE SET NULL,
  amount            NUMERIC NOT NULL DEFAULT 0,
  due_date          TEXT NOT NULL DEFAULT '',
  payment_status    TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (payment_status IN ('Pending','Paid','Overdue','Partial')),
  amount_paid       NUMERIC NOT NULL DEFAULT 0,
  payment_date      TEXT,
  linked_expense_id UUID REFERENCES expenses(expense_id) ON DELETE SET NULL,
  invoice_reference TEXT,
  payment_method    TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  budget_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period          TEXT NOT NULL DEFAULT '',
  budget_type     TEXT NOT NULL DEFAULT 'Expense'
                  CHECK (budget_type IN ('Revenue','Expense')),
  category        TEXT,
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up actions table (if not already created)
CREATE TABLE IF NOT EXISTS follow_up_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type     TEXT NOT NULL DEFAULT 'rfq_followup',
  entity_type     TEXT NOT NULL DEFAULT 'rfq',
  entity_id       UUID,
  title           TEXT NOT NULL DEFAULT '',
  description     TEXT,
  due_date        TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','snoozed')),
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  recurrence_days INTEGER DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- Enable Row Level Security
-- ====================================================================
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_actions ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- RLS Policies — authenticated users can read/write all bookkeeping data
-- ====================================================================
DROP POLICY IF EXISTS "allow_auth_invoices"        ON invoices;
DROP POLICY IF EXISTS "allow_auth_expenses"        ON expenses;
DROP POLICY IF EXISTS "allow_auth_payment_records" ON payment_records;
DROP POLICY IF EXISTS "allow_auth_payables"        ON payables;
DROP POLICY IF EXISTS "allow_auth_budgets"         ON budgets;
DROP POLICY IF EXISTS "allow_auth_followups"       ON follow_up_actions;

CREATE POLICY "allow_auth_invoices"
  ON invoices FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_auth_expenses"
  ON expenses FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_auth_payment_records"
  ON payment_records FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_auth_payables"
  ON payables FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_auth_budgets"
  ON budgets FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_auth_followups"
  ON follow_up_actions FOR ALL USING (auth.uid() IS NOT NULL);
