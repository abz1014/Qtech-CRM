-- ============================================
-- CLEANUP MOCK DATA SCRIPT
-- ============================================
-- Removes all test data added by SEED_MOCK_DATA.sql
-- Safe to run: uses cascade deletes based on created_by
--
-- WARNING: This deletes test data
-- Make sure to backup your real data first
-- ============================================

DO $$
DECLARE
  admin_id UUID;
  deleted_clients INT := 0;
  deleted_vendors INT := 0;
  deleted_invoices INT := 0;
  deleted_expenses INT := 0;
  deleted_payables INT := 0;
  deleted_budgets INT := 0;
BEGIN
  -- Get the first admin user (should be the one who created mock data)
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found.';
  END IF;

  -- ============================================
  -- 1. DELETE MOCK BUDGETS
  -- ============================================
  DELETE FROM budgets
  WHERE created_by = admin_id
    AND period = '2026-05-01'
    AND budget_type = 'Expense'
    AND category IN (
      'Salaries', 'Office Expenses', 'Travel', 'Equipment',
      'Software Subscriptions', 'Utilities', 'Marketing',
      'Inventory/Procurement', 'Misc'
    );
  GET DIAGNOSTICS deleted_budgets = ROW_COUNT;

  -- ============================================
  -- 2. DELETE MOCK PAYMENT RECORDS
  -- ============================================
  DELETE FROM payment_records
  WHERE invoice_id IN (
    SELECT id FROM invoices
    WHERE created_by = admin_id
      AND invoice_number LIKE 'INV-2026-%'
  );

  -- ============================================
  -- 3. DELETE MOCK INVOICES
  -- ============================================
  DELETE FROM invoices
  WHERE created_by = admin_id
    AND invoice_number LIKE 'INV-2026-%';
  GET DIAGNOSTICS deleted_invoices = ROW_COUNT;

  -- ============================================
  -- 4. DELETE MOCK PAYABLES
  -- ============================================
  DELETE FROM payables
  WHERE created_by = admin_id;
  GET DIAGNOSTICS deleted_payables = ROW_COUNT;

  -- ============================================
  -- 5. DELETE MOCK EXPENSES
  -- ============================================
  DELETE FROM expenses
  WHERE created_by = admin_id
    AND date BETWEEN '2026-03-01' AND '2026-05-31';
  GET DIAGNOSTICS deleted_expenses = ROW_COUNT;

  -- ============================================
  -- 6. DELETE MOCK VENDORS
  -- ============================================
  DELETE FROM vendors
  WHERE created_by = admin_id
    AND name IN (
      'Office Supplies Plus',
      'IT Equipment Supplier',
      'Software License Provider',
      'Travel Services'
    );
  GET DIAGNOSTICS deleted_vendors = ROW_COUNT;

  -- ============================================
  -- 7. DELETE MOCK CLIENTS
  -- ============================================
  DELETE FROM clients
  WHERE created_by = admin_id
    AND company_name IN (
      'Tech Solutions Ltd',
      'Digital Marketing Co',
      'Software House',
      'Business Consulting',
      'E-Commerce Store'
    );
  GET DIAGNOSTICS deleted_clients = ROW_COUNT;

  -- ============================================
  -- SUMMARY
  -- ============================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MOCK DATA CLEANUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Clients deleted: %', deleted_clients;
  RAISE NOTICE 'Vendors deleted: %', deleted_vendors;
  RAISE NOTICE 'Invoices deleted: %', deleted_invoices;
  RAISE NOTICE 'Expenses deleted: %', deleted_expenses;
  RAISE NOTICE 'Payables deleted: %', deleted_payables;
  RAISE NOTICE 'Budgets deleted: %', deleted_budgets;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total records deleted: %',
    (deleted_clients + deleted_vendors + deleted_invoices +
     deleted_expenses + deleted_payables + deleted_budgets);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Your real data is safe (not deleted).';
  RAISE NOTICE 'Database is ready for production.';

END $$;
