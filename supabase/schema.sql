-- Q-Tech CRM Database Schema
-- Paste this into your Supabase SQL editor and run it.

-- Users (team members) table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'sales', 'engineer')),
  password TEXT NOT NULL DEFAULT ''
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  lead_source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'warm' CHECK (status IN ('hot', 'warm', 'cold')),
  follow_up_date TEXT NOT NULL DEFAULT '',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  products_supplied TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders table (rfq_id has no FK to avoid circular dependency with rfqs)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  sales_person_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL DEFAULT '',
  order_value NUMERIC NOT NULL DEFAULT 0,
  cost_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'quotation',
  notes TEXT NOT NULL DEFAULT '',
  confirmed_date TEXT,
  rfq_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order engineers table
CREATE TABLE IF NOT EXISTS order_engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  site_location TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  expected_completion TEXT NOT NULL DEFAULT '',
  commissioning_status TEXT NOT NULL DEFAULT 'pending' CHECK (commissioning_status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQs table (converted_order_id has no FK to avoid circular dependency with orders)
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  rfq_date TEXT NOT NULL DEFAULT '',
  estimated_value NUMERIC NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'quoted', 'lost', 'converted')),
  notes TEXT NOT NULL DEFAULT '',
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQ Line Items table
CREATE TABLE IF NOT EXISTS rfq_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  specification TEXT NOT NULL DEFAULT '',
  target_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier Inquiries table
CREATE TABLE IF NOT EXISTS supplier_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  sent_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'no_response')),
  email_draft TEXT NOT NULL DEFAULT '',
  follow_up_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier Quotes table
CREATE TABLE IF NOT EXISTS supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES supplier_inquiries(id) ON DELETE SET NULL,
  received_at TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  moq INTEGER NOT NULL DEFAULT 1,
  validity_days INTEGER NOT NULL DEFAULT 30,
  notes TEXT NOT NULL DEFAULT '',
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;

-- Open policies so the anon key can read/write all tables (internal CRM, no public access)
DROP POLICY IF EXISTS "allow_all" ON users;
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON clients;
CREATE POLICY "allow_all" ON clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON prospects;
CREATE POLICY "allow_all" ON prospects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON vendors;
CREATE POLICY "allow_all" ON vendors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON orders;
CREATE POLICY "allow_all" ON orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON order_engineers;
CREATE POLICY "allow_all" ON order_engineers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON rfqs;
CREATE POLICY "allow_all" ON rfqs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON rfq_line_items;
CREATE POLICY "allow_all" ON rfq_line_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON supplier_inquiries;
CREATE POLICY "allow_all" ON supplier_inquiries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON supplier_quotes;
CREATE POLICY "allow_all" ON supplier_quotes FOR ALL USING (true) WITH CHECK (true);

-- Insert your initial admin user here (change the values)
-- INSERT INTO users (name, email, role, password) VALUES ('Admin Name', 'admin@yourcompany.com', 'admin', 'your_password');
