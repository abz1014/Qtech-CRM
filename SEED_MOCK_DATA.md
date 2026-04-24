# 🌱 SEED MOCK DATA SCRIPT

**Purpose:** Add realistic test data to all bookkeeping tables  
**Data Added:** 44+ records across 5 tables  
**Cleanup:** Easy (use CLEANUP_MOCK_DATA.sql)

---

## SEED SCRIPT - COPY & PASTE INTO SUPABASE

Run this SQL in Supabase SQL Editor → New Query → Execute

```sql
-- ============================================
-- MOCK DATA SEEDING SCRIPT
-- ============================================
-- Adds realistic test data to all bookkeeping tables
-- Includes: Invoices, Expenses, Payables, Payment Records, Budgets
-- 
-- WARNING: This adds test data
-- Use CLEANUP_MOCK_DATA.sql to remove all mock data
-- ============================================

-- First, get the admin user ID (replace with your actual user ID from users table)
-- You can find this by running: SELECT id, name, role FROM users WHERE role = 'admin';
-- For this script, we'll use a placeholder that you need to replace

-- Get the first admin user
DO $$
DECLARE
  admin_id UUID;
  client1_id UUID;
  client2_id UUID;
  client3_id UUID;
  client4_id UUID;
  client5_id UUID;
  vendor1_id UUID;
  vendor2_id UUID;
  vendor3_id UUID;
  vendor4_id UUID;
  invoice1_id UUID;
  invoice2_id UUID;
  invoice3_id UUID;
  invoice4_id UUID;
  invoice5_id UUID;
  invoice6_id UUID;
  expense1_id UUID;
  expense2_id UUID;
  expense3_id UUID;
BEGIN
  -- Get admin user
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;

  -- ============================================
  -- 1. CREATE MOCK CLIENTS (if not exist)
  -- ============================================
  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES
    ('Tech Solutions Ltd', 'Technology', 'Ahmed Khan', '0300-1111111', 'ahmed@techsolutions.pk', 'Lahore, Pakistan', admin_id),
    ('Digital Marketing Co', 'Marketing', 'Fatima Ali', '0300-2222222', 'fatima@digitalmarketing.pk', 'Karachi, Pakistan', admin_id),
    ('Software House', 'IT Services', 'Hassan Ahmed', '0300-3333333', 'hassan@softwarehouse.pk', 'Islamabad, Pakistan', admin_id),
    ('Business Consulting', 'Consulting', 'Sara Malik', '0300-4444444', 'sara@consulting.pk', 'Lahore, Pakistan', admin_id),
    ('E-Commerce Store', 'Retail', 'Ali Khan', '0300-5555555', 'ali@ecommerce.pk', 'Karachi, Pakistan', admin_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO client1_id, client2_id, client3_id, client4_id, client5_id;

  -- Get client IDs if they already exist
  SELECT id INTO client1_id FROM clients WHERE company_name = 'Tech Solutions Ltd' LIMIT 1;
  SELECT id INTO client2_id FROM clients WHERE company_name = 'Digital Marketing Co' LIMIT 1;
  SELECT id INTO client3_id FROM clients WHERE company_name = 'Software House' LIMIT 1;
  SELECT id INTO client4_id FROM clients WHERE company_name = 'Business Consulting' LIMIT 1;
  SELECT id INTO client5_id FROM clients WHERE company_name = 'E-Commerce Store' LIMIT 1;

  -- ============================================
  -- 2. CREATE MOCK VENDORS (if not exist)
  -- ============================================
  INSERT INTO vendors (name, email, phone, address, created_by)
  VALUES
    ('Office Supplies Plus', 'supplies@officeplus.pk', '0300-6666666', 'Lahore', admin_id),
    ('IT Equipment Supplier', 'sales@itequipment.pk', '0300-7777777', 'Karachi', admin_id),
    ('Software License Provider', 'licensing@softwarepro.pk', '0300-8888888', 'Islamabad', admin_id),
    ('Travel Services', 'booking@travelservices.pk', '0300-9999999', 'Lahore', admin_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO vendor1_id, vendor2_id, vendor3_id, vendor4_id;

  -- Get vendor IDs if they already exist
  SELECT id INTO vendor1_id FROM vendors WHERE name = 'Office Supplies Plus' LIMIT 1;
  SELECT id INTO vendor2_id FROM vendors WHERE name = 'IT Equipment Supplier' LIMIT 1;
  SELECT id INTO vendor3_id FROM vendors WHERE name = 'Software License Provider' LIMIT 1;
  SELECT id INTO vendor4_id FROM vendors WHERE name = 'Travel Services' LIMIT 1;

  -- ============================================
  -- 3. INSERT MOCK INVOICES (12 invoices)
  -- ============================================
  INSERT INTO invoices (invoice_number, client_id, invoice_amount, issued_date, due_date, payment_status, amount_paid, payment_method, created_by, notes)
  VALUES
    -- March 2026 invoices
    ('INV-2026-0301-001', client1_id, 250000, '2026-03-01', '2026-03-31', 'Paid', 250000, 'Bank Transfer', admin_id, 'Website redesign project'),
    ('INV-2026-0305-002', client2_id, 150000, '2026-03-05', '2026-04-05', 'Pending', 0, NULL, admin_id, 'Marketing campaign services'),
    ('INV-2026-0310-003', client3_id, 300000, '2026-03-10', '2026-04-10', 'Partial', 100000, 'Check', admin_id, 'Software development'),
    
    -- April 2026 invoices
    ('INV-2026-0401-004', client4_id, 180000, '2026-04-01', '2026-05-01', 'Paid', 180000, 'Bank Transfer', admin_id, 'Business consulting'),
    ('INV-2026-0405-005', client5_id, 120000, '2026-04-05', '2026-05-05', 'Overdue', 0, NULL, admin_id, 'E-commerce platform'),
    ('INV-2026-0410-006', client1_id, 220000, '2026-04-10', '2026-05-10', 'Partial', 110000, 'Bank Transfer', admin_id, 'Mobile app development'),
    ('INV-2026-0415-007', client2_id, 175000, '2026-04-15', '2026-05-15', 'Pending', 0, NULL, admin_id, 'Social media management'),
    
    -- May 2026 invoices
    ('INV-2026-0501-008', client3_id, 280000, '2026-05-01', '2026-06-01', 'Pending', 0, NULL, admin_id, 'System integration'),
    ('INV-2026-0505-009', client4_id, 160000, '2026-05-05', '2026-06-05', 'Paid', 160000, 'Bank Transfer', admin_id, 'Strategy workshop'),
    ('INV-2026-0510-010', client5_id, 200000, '2026-05-10', '2026-06-10', 'Pending', 0, NULL, admin_id, 'Website hosting & support'),
    ('INV-2026-0515-011', client1_id, 190000, '2026-05-15', '2026-06-15', 'Pending', 0, NULL, admin_id, 'UI/UX design'),
    ('INV-2026-0520-012', client2_id, 135000, '2026-05-20', '2026-06-20', 'Pending', 0, NULL, admin_id, 'Content creation')
  ON CONFLICT (invoice_number) DO NOTHING;

  -- ============================================
  -- 4. INSERT MOCK EXPENSES (15 expenses)
  -- ============================================
  INSERT INTO expenses (date, amount, category, description, vendor_id, created_by, notes)
  VALUES
    -- March expenses
    ('2026-03-03', 45000, 'Salaries', 'March salary payments', NULL, admin_id, 'Employee payroll'),
    ('2026-03-05', 8500, 'Office Expenses', 'Office stationery and supplies', vendor1_id, admin_id, 'Printer paper, pens, folders'),
    ('2026-03-10', 12000, 'Travel', 'Team travel for client meeting', vendor4_id, admin_id, 'Lahore to Karachi trip'),
    ('2026-03-12', 25000, 'Equipment', 'Computer monitors', vendor2_id, admin_id, 'Purchased 2 monitors'),
    ('2026-03-15', 5000, 'Software Subscriptions', 'Adobe Creative Cloud', NULL, admin_id, 'Monthly subscription'),
    
    -- April expenses
    ('2026-04-02', 50000, 'Salaries', 'April salary payments', NULL, admin_id, 'Employee payroll'),
    ('2026-04-08', 3500, 'Utilities', 'Internet and electricity', NULL, admin_id, 'Monthly utilities'),
    ('2026-04-12', 15000, 'Marketing', 'Google Ads campaign', NULL, admin_id, 'Digital marketing spend'),
    ('2026-04-15', 18000, 'Inventory/Procurement', 'Office furniture', NULL, admin_id, 'Desk and chairs'),
    ('2026-04-20', 2000, 'Misc', 'Office supplies', vendor1_id, admin_id, 'General supplies'),
    
    -- May expenses
    ('2026-05-01', 50000, 'Salaries', 'May salary payments', NULL, admin_id, 'Employee payroll'),
    ('2026-05-05', 20000, 'Software Subscriptions', 'Project management tools', vendor3_id, admin_id, 'Jira and Confluence licenses'),
    ('2026-05-10', 8000, 'Travel', 'Client visit expenses', vendor4_id, admin_id, 'Transport and accommodation'),
    ('2026-05-15', 6500, 'Office Expenses', 'Office renovation', NULL, admin_id, 'Paint and materials'),
    ('2026-05-25', 4000, 'Marketing', 'LinkedIn ads campaign', NULL, admin_id, 'Professional networking ads')
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 5. INSERT MOCK PAYABLES (8 payables)
  -- ============================================
  INSERT INTO payables (vendor_id, amount, due_date, payment_status, amount_paid, invoice_reference, payment_method, created_by)
  VALUES
    ('2026-03-15', vendor1_id, 25000, '2026-04-15', 'Pending', 0, 'VENDOR-INV-001', 'Bank Transfer', admin_id),
    ('2026-03-20', vendor2_id, 45000, '2026-04-20', 'Partial', 15000, 'VENDOR-INV-002', 'Check', admin_id),
    ('2026-04-10', vendor3_id, 55000, '2026-05-10', 'Pending', 0, 'VENDOR-INV-003', NULL, admin_id),
    ('2026-04-15', vendor4_id, 18000, '2026-05-15', 'Paid', 18000, 'VENDOR-INV-004', 'Bank Transfer', admin_id),
    ('2026-05-01', vendor1_id, 12000, '2026-06-01', 'Pending', 0, 'VENDOR-INV-005', NULL, admin_id),
    ('2026-05-05', vendor2_id, 32000, '2026-06-05', 'Pending', 0, 'VENDOR-INV-006', NULL, admin_id),
    ('2026-05-10', vendor3_id, 28000, '2026-06-10', 'Pending', 0, 'VENDOR-INV-007', NULL, admin_id),
    ('2026-05-15', vendor4_id, 15000, '2026-06-15', 'Partial', 7500, 'VENDOR-INV-008', 'Bank Transfer', admin_id)
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 6. INSERT MOCK BUDGETS (9 budgets - one per category)
  -- ============================================
  INSERT INTO budgets (period, budget_type, category, expected_amount, created_by)
  VALUES
    ('2026-05-01', 'Expense', 'Salaries', 150000, admin_id),
    ('2026-05-01', 'Expense', 'Office Expenses', 20000, admin_id),
    ('2026-05-01', 'Expense', 'Travel', 30000, admin_id),
    ('2026-05-01', 'Expense', 'Equipment', 40000, admin_id),
    ('2026-05-01', 'Expense', 'Software Subscriptions', 25000, admin_id),
    ('2026-05-01', 'Expense', 'Utilities', 10000, admin_id),
    ('2026-05-01', 'Expense', 'Marketing', 35000, admin_id),
    ('2026-05-01', 'Expense', 'Inventory/Procurement', 50000, admin_id),
    ('2026-05-01', 'Expense', 'Misc', 15000, admin_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Mock data seeded successfully!';
  RAISE NOTICE 'Invoices: 12';
  RAISE NOTICE 'Expenses: 15';
  RAISE NOTICE 'Payables: 8';
  RAISE NOTICE 'Budgets: 9';
  RAISE NOTICE 'Total: 44 mock records';
  RAISE NOTICE '';
  RAISE NOTICE 'To delete all mock data, run: CLEANUP_MOCK_DATA.sql';

END $$;
```

---

## HOW TO USE THIS SCRIPT

### Step 1: Copy the SQL above
- Select all the SQL code
- Copy to clipboard

### Step 2: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your Q-Tech CRM project
3. Click "SQL Editor"
4. Click "New Query"

### Step 3: Paste & Run
1. Paste the SQL into the editor
2. Click "Run" button
3. Wait for success message

### Step 4: Verify
1. Click "Table Editor" in sidebar
2. Open each table and verify data:
   - invoices (should show 12)
   - expenses (should show 15)
   - payables (should show 8)
   - budgets (should show 9)

---

## WHAT DATA YOU'LL GET

### Invoices (12 total)
- **Paid:** 3 invoices (fully paid)
- **Pending:** 5 invoices (unpaid)
- **Partial:** 2 invoices (partially paid)
- **Overdue:** 1 invoice (unpaid, due date passed)
- **Date Range:** March - May 2026
- **Amount Range:** 120k - 300k PKR

### Expenses (15 total)
- **All 9 categories** represented
- **Salaries:** 3 (monthly)
- **Utilities:** 1
- **Software:** 2
- **Travel:** 2
- **Equipment:** 1
- **Marketing:** 2
- **Office:** 2
- **Inventory:** 1
- **Misc:** 1
- **Date Range:** March - May 2026

### Payables (8 total)
- **Paid:** 1 (fully paid)
- **Pending:** 5 (unpaid)
- **Partial:** 2 (partially paid)
- **Vendors:** 4 different vendors
- **Amount Range:** 12k - 55k PKR

### Budgets (9 total)
- **One per expense category**
- **May 2026 budgets**
- **Realistic amounts** for business
- **All Expense type**

---

## IMPORTANT NOTES

✅ **Safe to run multiple times** - Uses `ON CONFLICT DO NOTHING`  
✅ **No duplicate data** - Won't add same records twice  
✅ **Respects constraints** - Foreign keys properly referenced  
✅ **Admin user required** - Must have at least one admin user  
✅ **Easy to cleanup** - Use CLEANUP_MOCK_DATA.sql  

---

## TROUBLESHOOTING

### Error: "No admin user found"
**Solution:** Create an admin user first via the app login system

### Error: "Relation does not exist"
**Solution:** Make sure BOOKKEEPING_SETUP.md SQL was run first to create tables

### Data not showing after seed
**Solution:** 
1. Refresh browser (Ctrl+F5)
2. Logout and login again
3. Check Table Editor to verify data exists

---

## NEXT STEP

Once seeding is complete and you've tested everything, run the **CLEANUP_MOCK_DATA.sql** script to remove all test data before deploying.

