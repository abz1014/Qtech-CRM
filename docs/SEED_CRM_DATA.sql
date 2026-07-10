-- ============================================
-- SEED CRM DATA SCRIPT
-- ============================================
-- Adds realistic test data to CRM tables
-- Includes: Prospects, RFQs, Orders, RFQ Line Items
-- Date Range: March - May 2026
-- ============================================

DO $$
DECLARE
  admin_id UUID;
  prospect1_id UUID;
  prospect2_id UUID;
  prospect3_id UUID;
  prospect4_id UUID;
  rfq1_id UUID;
  rfq2_id UUID;
  rfq3_id UUID;
  rfq4_id UUID;
  rfq5_id UUID;
  order1_id UUID;
  order2_id UUID;
  order3_id UUID;
BEGIN
  -- Get admin user
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;

  -- ============================================
  -- 1. CREATE MOCK PROSPECTS
  -- ============================================
  INSERT INTO prospects (company_name, contact_person, phone, email)
  VALUES
    ('Future Industries Inc', 'John Smith', '0300-1234567', 'john@futureindustries.pk'),
    ('Global Tech Ventures', 'Emma Johnson', '0300-2345678', 'emma@globaltech.pk'),
    ('Prime Manufacturing Ltd', 'Ahmed Hassan', '0300-3456789', 'ahmed@primemfg.pk'),
    ('Innovation Systems Co', 'Sarah Williams', '0300-4567890', 'sarah@innovationsys.pk')
  ON CONFLICT DO NOTHING;

  SELECT id INTO prospect1_id FROM prospects WHERE company_name = 'Future Industries Inc' LIMIT 1;
  SELECT id INTO prospect2_id FROM prospects WHERE company_name = 'Global Tech Ventures' LIMIT 1;
  SELECT id INTO prospect3_id FROM prospects WHERE company_name = 'Prime Manufacturing Ltd' LIMIT 1;
  SELECT id INTO prospect4_id FROM prospects WHERE company_name = 'Innovation Systems Co' LIMIT 1;

  -- ============================================
  -- 2. CREATE MOCK RFQs (5 total)
  -- ============================================
  INSERT INTO rfqs (company_name, contact_person, phone, email, rfq_description, rfq_date, est_value, status, priority)
  VALUES
    ('Future Industries Inc', 'John Smith', '0300-1234567', 'john@futureindustries.pk', 'Industrial motors and controls', '2026-03-05', 500000, 'Quoted', 'High'),
    ('Global Tech Ventures', 'Emma Johnson', '0300-2345678', 'emma@globaltech.pk', 'Server equipment and networking', '2026-03-10', 1200000, 'Floated', 'Critical'),
    ('Prime Manufacturing Ltd', 'Ahmed Hassan', '0300-3456789', 'ahmed@primemfg.pk', 'Production machinery parts', '2026-04-01', 800000, 'Quoted', 'High'),
    ('Innovation Systems Co', 'Sarah Williams', '0300-4567890', 'sarah@innovationsys.pk', 'Control systems and software', '2026-04-15', 1500000, 'Responded', 'Medium'),
    ('Future Industries Inc', 'John Smith', '0300-1234567', 'john@futureindustries.pk', 'Spare parts and maintenance', '2026-05-01', 350000, 'Floated', 'Low')
  ON CONFLICT DO NOTHING;

  SELECT id INTO rfq1_id FROM rfqs WHERE rfq_description = 'Industrial motors and controls' LIMIT 1;
  SELECT id INTO rfq2_id FROM rfqs WHERE rfq_description = 'Server equipment and networking' LIMIT 1;
  SELECT id INTO rfq3_id FROM rfqs WHERE rfq_description = 'Production machinery parts' LIMIT 1;
  SELECT id INTO rfq4_id FROM rfqs WHERE rfq_description = 'Control systems and software' LIMIT 1;
  SELECT id INTO rfq5_id FROM rfqs WHERE rfq_description = 'Spare parts and maintenance' LIMIT 1;

  -- ============================================
  -- 3. CREATE RFQ LINE ITEMS (15 items)
  -- ============================================
  INSERT INTO rfq_line_items (rfq_id, item_description, quantity, unit_price)
  VALUES
    -- RFQ 1: Industrial motors
    (rfq1_id, '3-phase electric motor 5HP', 10, 45000),
    (rfq1_id, 'Motor control panel', 5, 65000),
    (rfq1_id, 'Installation and commissioning', 1, 50000),

    -- RFQ 2: Server equipment
    (rfq2_id, 'Server rack mounted computer', 5, 250000),
    (rfq2_id, 'Network switch 48-port', 2, 150000),
    (rfq2_id, 'Fiber optic cables (1000m)', 1, 200000),
    (rfq2_id, 'UPS backup power system', 2, 120000),

    -- RFQ 3: Production machinery
    (rfq3_id, 'CNC cutting machine', 2, 400000),
    (rfq3_id, 'Hydraulic pump assembly', 5, 80000),

    -- RFQ 4: Control systems
    (rfq4_id, 'PLC control unit', 3, 250000),
    (rfq4_id, 'HMI touchscreen interface', 3, 180000),
    (rfq4_id, 'Custom software development', 1, 450000),

    -- RFQ 5: Spare parts
    (rfq5_id, 'Bearing assemblies (set of 20)', 1, 180000),
    (rfq5_id, 'Seal kits and gaskets', 1, 85000),
    (rfq5_id, 'Lubricants and maintenance supplies', 1, 85000)
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 4. CREATE MOCK ORDERS (3 total - converted from RFQs)
  -- ============================================
  INSERT INTO orders (rfq_id, vendor_id, order_date, delivery_date, total_value, status)
  VALUES
    (rfq1_id, (SELECT id FROM vendors LIMIT 1), '2026-03-15', '2026-04-15', 600000, 'confirmed'),
    (rfq2_id, (SELECT id FROM vendors LIMIT 1), '2026-03-25', '2026-05-25', 1200000, 'procurement'),
    (rfq3_id, (SELECT id FROM vendors OFFSET 1 LIMIT 1), '2026-04-10', '2026-05-10', 960000, 'installation')
  ON CONFLICT DO NOTHING;

  SELECT id INTO order1_id FROM orders WHERE total_value = 600000 LIMIT 1;
  SELECT id INTO order2_id FROM orders WHERE total_value = 1200000 LIMIT 1;
  SELECT id INTO order3_id FROM orders WHERE total_value = 960000 LIMIT 1;

  -- ============================================
  -- 5. CREATE MOCK ORDER ENGINEERS (6 assignments)
  -- ============================================
  INSERT INTO order_engineers (order_id, engineer_name, role, assignment_date, commissioning_status)
  VALUES
    (order1_id, 'Ali Rahman', 'Site Engineer', '2026-04-01', 'Pending'),
    (order1_id, 'Fatima Khan', 'Electrical Engineer', '2026-04-01', 'In Progress'),
    (order2_id, 'Hassan Ahmed', 'Project Manager', '2026-04-15', 'Not Started'),
    (order2_id, 'Sara Malik', 'Systems Engineer', '2026-04-15', 'Not Started'),
    (order3_id, 'Muhammad Asif', 'Installation Lead', '2026-05-01', 'In Progress'),
    (order3_id, 'Ayesha Syed', 'Quality Inspector', '2026-05-01', 'Pending')
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 6. CREATE MOCK SUPPLIER INQUIRIES (6 inquiries)
  -- ============================================
  INSERT INTO supplier_inquiries (rfq_id, vendor_id, inquiry_description, sent_at, status)
  VALUES
    (rfq1_id, (SELECT id FROM vendors LIMIT 1), 'Request for quote on industrial motors', '2026-03-05', 'Responded'),
    (rfq2_id, (SELECT id FROM vendors OFFSET 1 LIMIT 1), 'Server equipment specifications and pricing', '2026-03-10', 'Responded'),
    (rfq3_id, (SELECT id FROM vendors OFFSET 2 LIMIT 1), 'CNC machinery quotation', '2026-04-01', 'Pending'),
    (rfq4_id, (SELECT id FROM vendors OFFSET 1 LIMIT 1), 'Custom control system development', '2026-04-15', 'Responded'),
    (rfq5_id, (SELECT id FROM vendors LIMIT 1), 'Spare parts availability and pricing', '2026-05-01', 'Responded'),
    (rfq2_id, (SELECT id FROM vendors OFFSET 3 LIMIT 1), 'Alternative vendor for networking equipment', '2026-03-12', 'Pending')
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 7. CREATE MOCK SUPPLIER QUOTES (5 quotes)
  -- ============================================
  INSERT INTO supplier_quotes (rfq_id, vendor_id, quote_description, quoted_amount, received_at, status)
  VALUES
    (rfq1_id, (SELECT id FROM vendors LIMIT 1), 'Complete motor and control solution', 600000, '2026-03-08', 'Approved'),
    (rfq2_id, (SELECT id FROM vendors OFFSET 1 LIMIT 1), 'Enterprise server and networking package', 1200000, '2026-03-15', 'Approved'),
    (rfq3_id, (SELECT id FROM vendors OFFSET 2 LIMIT 1), 'CNC machinery with installation', 960000, '2026-04-05', 'Under Review'),
    (rfq4_id, (SELECT id FROM vendors OFFSET 1 LIMIT 1), 'Integrated control system solution', 1500000, '2026-04-20', 'Approved'),
    (rfq2_id, (SELECT id FROM vendors OFFSET 3 LIMIT 1), 'Alternative networking quote', 1150000, '2026-03-18', 'Rejected')
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- SUMMARY
  -- ============================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CRM DATA SEEDED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Prospects: 4';
  RAISE NOTICE 'RFQs: 5';
  RAISE NOTICE 'RFQ Line Items: 15';
  RAISE NOTICE 'Orders: 3';
  RAISE NOTICE 'Order Engineers: 6';
  RAISE NOTICE 'Supplier Inquiries: 6';
  RAISE NOTICE 'Supplier Quotes: 5';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total: 44 CRM records added';
  RAISE NOTICE '========================================';

END $$;
