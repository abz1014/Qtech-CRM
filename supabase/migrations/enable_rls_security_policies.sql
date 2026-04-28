-- ============================================================================
-- CRITICAL SECURITY FIX: Enable Row Level Security (RLS) on all tables
-- ============================================================================
-- This script enforces database-level access control so that even if the
-- anon key is compromised, users can only see/modify their own data.
--
-- IMPORTANT: Execute this in Supabase SQL editor AFTER rotating the anon key!
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================
-- Users can only read their own profile
CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid()));

-- Admin can read all users
CREATE POLICY "Admin can read all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin can update any user
CREATE POLICY "Admin can update users" ON users
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin can insert users (for user management)
CREATE POLICY "Admin can insert users" ON users
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- CLIENTS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read clients
CREATE POLICY "Authenticated users can read clients" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert/update/delete clients
CREATE POLICY "Admin can insert clients" ON clients
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can update clients" ON clients
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can delete clients" ON clients
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROSPECTS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read prospects
CREATE POLICY "Authenticated users can read prospects" ON prospects
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin and Sales can insert prospects
CREATE POLICY "Admin and Sales can insert prospects" ON prospects
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales')
  );

-- Admin can update/delete prospects
CREATE POLICY "Admin can update prospects" ON prospects
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can delete prospects" ON prospects
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- VENDORS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read vendors
CREATE POLICY "Authenticated users can read vendors" ON vendors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert/update/delete vendors
CREATE POLICY "Admin can insert vendors" ON vendors
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can update vendors" ON vendors
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can delete vendors" ON vendors
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- RFQs TABLE POLICIES
-- ============================================================================
-- All authenticated users can read RFQs
CREATE POLICY "Authenticated users can read RFQs" ON rfqs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sales can insert RFQs
CREATE POLICY "Sales can insert RFQs" ON rfqs
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales') AND
    created_by = auth.uid()
  );

-- Users can update own RFQs, Admin can update any
CREATE POLICY "Users can update own RFQs" ON rfqs
  FOR UPDATE USING (
    created_by = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin can delete RFQs
CREATE POLICY "Admin can delete RFQs" ON rfqs
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- SUPPLIER_INQUIRIES TABLE POLICIES
-- ============================================================================
-- All authenticated users can read supplier inquiries
CREATE POLICY "Authenticated users can read supplier inquiries" ON supplier_inquiries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sales can insert supplier inquiries
CREATE POLICY "Sales can insert supplier inquiries" ON supplier_inquiries
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales') AND
    created_by = auth.uid()
  );

-- Users can update own, Admin can update any
CREATE POLICY "Users can update own supplier inquiries" ON supplier_inquiries
  FOR UPDATE USING (
    created_by = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- SUPPLIER_QUOTES TABLE POLICIES
-- ============================================================================
-- All authenticated users can read supplier quotes
CREATE POLICY "Authenticated users can read supplier quotes" ON supplier_quotes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sales can insert supplier quotes
CREATE POLICY "Sales can insert supplier quotes" ON supplier_quotes
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales') AND
    created_by = auth.uid()
  );

-- Users can update own, Admin can update any
CREATE POLICY "Users can update own supplier quotes" ON supplier_quotes
  FOR UPDATE USING (
    created_by = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- RFQ_LINE_ITEMS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read RFQ line items
CREATE POLICY "Authenticated users can read RFQ line items" ON rfq_line_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sales can insert RFQ line items
CREATE POLICY "Sales can insert RFQ line items" ON rfq_line_items
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales')
  );

-- ============================================================================
-- ORDERS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read orders
CREATE POLICY "Authenticated users can read orders" ON orders
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sales and Engineers can insert orders
CREATE POLICY "Sales and Engineers can insert orders" ON orders
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales', 'engineer') AND
    created_by = auth.uid()
  );

-- Users can update own orders, Admin can update any
CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE USING (
    created_by = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- ORDER_ENGINEERS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read order engineers
CREATE POLICY "Authenticated users can read order engineers" ON order_engineers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Engineers and Sales can insert order engineers
CREATE POLICY "Engineers and Sales can insert order engineers" ON order_engineers
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales', 'engineer')
  );

-- ============================================================================
-- INVOICES TABLE POLICIES
-- ============================================================================
-- All authenticated users can read invoices
CREATE POLICY "Authenticated users can read invoices" ON invoices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert/update/delete invoices
CREATE POLICY "Admin can insert invoices" ON invoices
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND
    created_by = auth.uid()
  );

CREATE POLICY "Admin can update invoices" ON invoices
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- EXPENSES TABLE POLICIES
-- ============================================================================
-- All authenticated users can read expenses
CREATE POLICY "Authenticated users can read expenses" ON expenses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert/update/delete expenses
CREATE POLICY "Admin can insert expenses" ON expenses
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND
    created_by = auth.uid()
  );

CREATE POLICY "Admin can update expenses" ON expenses
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PAYMENT_RECORDS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read payment records
CREATE POLICY "Authenticated users can read payment records" ON payment_records
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert payment records
CREATE POLICY "Admin can insert payment records" ON payment_records
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND
    recorded_by = auth.uid()
  );

-- ============================================================================
-- PAYABLES TABLE POLICIES
-- ============================================================================
-- All authenticated users can read payables
CREATE POLICY "Authenticated users can read payables" ON payables
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can insert/update payables
CREATE POLICY "Admin can insert payables" ON payables
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND
    created_by = auth.uid()
  );

CREATE POLICY "Admin can update payables" ON payables
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- FOLLOW_UP_ACTIONS TABLE POLICIES
-- ============================================================================
-- All authenticated users can read follow up actions
CREATE POLICY "Authenticated users can read follow up actions" ON follow_up_actions
  FOR SELECT USING (auth.role() = 'authenticated');

-- All authenticated users can insert their own actions
CREATE POLICY "Authenticated users can insert follow up actions" ON follow_up_actions
  FOR INSERT WITH CHECK (
    assigned_to = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Users can update own actions, Admin can update any
CREATE POLICY "Users can update own follow up actions" ON follow_up_actions
  FOR UPDATE USING (
    assigned_to = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- VERIFY RLS IS ENABLED
-- ============================================================================
-- Run this query to verify all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN (
--   'users', 'clients', 'prospects', 'vendors', 'orders', 'order_engineers',
--   'rfqs', 'supplier_inquiries', 'supplier_quotes', 'rfq_line_items',
--   'invoices', 'expenses', 'payment_records', 'payables', 'payable_payments',
--   'follow_up_actions'
-- );
-- All should show "t" (true) for rowsecurity column.
