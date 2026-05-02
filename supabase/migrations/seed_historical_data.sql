-- ====================================================================
-- Q-Tech CRM Historical Data Migration
-- Source 1: RFQ and Quote Status_31-01-2025.xlsx
-- Source 2: Purchase and Sales Report_26-01-2025.xlsx
-- Covers:   October 2024 – January 2025
-- Run in:   Supabase SQL Editor
-- ====================================================================

DO $$
DECLARE
  admin_id            UUID;

  -- Client IDs
  c_ifl               UUID;
  c_ghani_khi         UUID;
  c_ghani_lhr         UUID;
  c_ghani             UUID;
  c_friesland         UUID;
  c_fauji             UUID;
  c_olympia           UUID;
  c_interloop         UUID;
  c_ibrahim           UUID;
  c_matco             UUID;
  c_sapphire          UUID;

  -- Vendor IDs
  v_meacon            UUID;
  v_ewo               UUID;
  v_moxa              UUID;
  v_mc                UUID;
  v_deao              UUID;
  v_goffran           UUID;
  v_redlion           UUID;
  v_heibi             UUID;
  v_shandong          UUID;
  v_tecto             UUID;
  v_siemens           UUID;

  -- RFQ IDs
  rfq_ifl_flowmeter   UUID;
  rfq_ghani_khi_prox  UUID;
  rfq_ifl_belimo      UUID;
  rfq_fries_panel     UUID;
  rfq_ifl_minebea     UUID;
  rfq_ghani_lhr_prox  UUID;
  rfq_fries_ctrl      UUID;
  rfq_fries_flow      UUID;
  rfq_fauji_geyser    UUID;
  rfq_fauji_air       UUID;
  rfq_fauji_motor     UUID;
  rfq_ghani_thermo    UUID;
  rfq_olympia_ph      UUID;
  rfq_ifl_hq1110      UUID;
  rfq_interloop_ro    UUID;
  rfq_fauji_temp      UUID;
  rfq_fauji_gauges    UUID;

  -- Order IDs
  ord_ibr_251809      UUID;
  ord_ibr_252446      UUID;
  ord_fries_225       UUID;
  ord_matco_flow      UUID;
  ord_ibr_air         UUID;
  ord_olympia_cond    UUID;
  ord_ibr_252993      UUID;
  ord_ibr_253074a     UUID;
  ord_ibr_253074b     UUID;
  ord_matco_siemens   UUID;
  ord_fries_xray      UUID;
  ord_ghani_sensor    UUID;
  ord_ghani_conv      UUID;
  ord_sapphire_a      UUID;
  ord_sapphire_b      UUID;
  ord_fries_panel     UUID;
  ord_ibr_oxygen      UUID;

BEGIN

  -- ----------------------------------------------------------------
  -- Get admin user (all records attributed to this user)
  -- ----------------------------------------------------------------
  SELECT id INTO admin_id
  FROM users
  WHERE email = 'abdullahsajid772@gmail.com'
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'Admin user not found – created_by will be NULL';
  END IF;

  -- ================================================================
  -- STEP 1: CLIENTS
  -- ================================================================

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('IFL Head Office', 'Textile & Fibres', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_ifl;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Ghani Glass (KHI)', 'Glass Manufacturing', '', '', '', 'Karachi, Pakistan', admin_id)
  RETURNING id INTO c_ghani_khi;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Ghani Glass (LHR)', 'Glass Manufacturing', '', '', '', 'Lahore, Pakistan', admin_id)
  RETURNING id INTO c_ghani_lhr;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Ghani Glass', 'Glass Manufacturing', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_ghani;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('FrieslandCampina Olpers', 'Dairy & FMCG', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_friesland;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Fauji Cement', 'Cement Manufacturing', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_fauji;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Olympia Chemicals', 'Chemicals', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_olympia;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Interloop', 'Textile', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_interloop;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Ibrahim Fibres Limited', 'Synthetic Fibres', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_ibrahim;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Matco Foods', 'FMCG / Rice Processing', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_matco;

  INSERT INTO clients (company_name, industry, contact_person, phone, email, address, created_by)
  VALUES ('Sapphire Finishing Mills Ltd', 'Textile', '', '', '', 'Pakistan', admin_id)
  RETURNING id INTO c_sapphire;

  RAISE NOTICE 'Clients inserted: 11';

  -- ================================================================
  -- STEP 2: VENDORS / SUPPLIERS
  -- ================================================================

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Meacon / RST Turkey', 'China / Turkey', '', '', '', 'Ultrasonic Flow Meters, Portable Flow Meters')
  RETURNING id INTO v_meacon;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('ewo GmbH Germany', 'Germany', '', '', '', 'Compressed Air Filters, Filter Inserts, Pneumatics')
  RETURNING id INTO v_ewo;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('XIAMEN TONGKONG Technology (Moxa Taiwan)', 'China / Taiwan', '', '', '', 'Serial to Ethernet Converters, Industrial Networking')
  RETURNING id INTO v_moxa;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('M&C Strongman', 'China', '', '', '', 'Electromagnetic Flow Meters')
  RETURNING id INTO v_mc;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('DEAO China (Siemens Distributor)', 'China', '', '', '', 'Siemens PLCs, Automation Controllers, CPUs')
  RETURNING id INTO v_deao;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Goffran Italy / ECIS UAE', 'Italy / UAE', '', '', '', 'Position Transmitters, Linear Sensors')
  RETURNING id INTO v_goffran;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Red Lion USA (via Four Stars)', 'USA', '', '', '', 'Magnetic Pickup Sensors, Converter Modules, Industrial Monitors')
  RETURNING id INTO v_redlion;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Heibi Createc', 'China', '', '', '', 'Conductivity Meters, Sensors')
  RETURNING id INTO v_heibi;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Shandong Schanghai', 'China', '', '', '', 'X-Ray Curtains, Safety Equipment')
  RETURNING id INTO v_shandong;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Tecto China', 'China', '', '', '', 'Oxygen Sensors')
  RETURNING id INTO v_tecto;

  INSERT INTO vendors (name, country, contact_person, phone, email, products_supplied)
  VALUES ('Siemens (Direct)', 'Germany', '', '', '', 'MV Panels, 11kV Panels, Industrial Automation')
  RETURNING id INTO v_siemens;

  RAISE NOTICE 'Vendors inserted: 11';

  -- ================================================================
  -- STEP 3: RFQs (from RFQ Status Jan 2025 sheet)
  -- Status mapping: "Bided" → quoted | "In process" → in_progress
  -- Priority: "Top Priority" → high | normal → medium
  -- ================================================================

  -- 1. IFL Head Office – Compressed Air & Ultrasonic Flowmeters
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ifl, 'IFL Head Office', '2025-01-20', 0, admin_id, 'medium', 'quoted',
          'RFQ #73481. Received via email. Due: 24/01/2025. Compressed Air & Ultrasonic Flowmeters.')
  RETURNING id INTO rfq_ifl_flowmeter;

  -- 2. Ghani Glass KHI – Proximity Switches
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ghani_khi, 'Ghani Glass (KHI)', '2025-01-20', 0, admin_id, 'medium', 'quoted',
          'Received via email. Due: 29/01/2025. Proximity Switches. We have bided.')
  RETURNING id INTO rfq_ghani_khi_prox;

  -- 3. IFL Head Office – Belimo + Dwyer
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ifl, 'IFL Head Office', '2025-01-21', 0, admin_id, 'medium', 'quoted',
          'Received via email. Due: 27/01/2025. Belimo + Dwyer valves/actuators. Bided.')
  RETURNING id INTO rfq_ifl_belimo;

  -- 4. FrieslandCampina – 11KV-MV Panels
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_friesland, 'FrieslandCampina Olpers', '2025-01-22', 0, admin_id, 'medium', 'quoted',
          'Received via WhatsApp. Due: 24/01/2025. 11KV-MV Panels. We have bided.')
  RETURNING id INTO rfq_fries_panel;

  -- 5. IFL Head Office – Minebea + CTS
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ifl, 'IFL Head Office', '2025-01-22', 0, admin_id, 'medium', 'quoted',
          'Received via email. Due: 27/01/2025. Minebea + CTS components. Bided.')
  RETURNING id INTO rfq_ifl_minebea;

  -- 6. Ghani Glass LHR – Proximity Switches + IC-14 Pin
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ghani_lhr, 'Ghani Glass (LHR)', '2025-01-23', 0, admin_id, 'medium', 'quoted',
          'Received via email. Due: 05/02/2025. Proximity Switches and IC-14 Pin. We have bided.')
  RETURNING id INTO rfq_ghani_lhr_prox;

  -- 7. FrieslandCampina – Controller
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_friesland, 'FrieslandCampina Olpers', '2025-01-23', 0, admin_id, 'medium', 'quoted',
          'Received via WhatsApp. Due: 29/01/2025. Controller. We have bided.')
  RETURNING id INTO rfq_fries_ctrl;

  -- 8. FrieslandCampina – Flowmeters (TOP PRIORITY - In Process)
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_friesland, 'FrieslandCampina Olpers', '2025-01-23', 0, admin_id, 'high', 'in_progress',
          'Received via email. Due: 05/02/2025. Flowmeters with Datalogging. TOP PRIORITY – will bid on time.')
  RETURNING id INTO rfq_fries_flow;

  -- 9. Fauji Cement – Element Geyser
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_fauji, 'Fauji Cement', '2025-01-24', 0, admin_id, 'medium', 'in_progress',
          'Received via email. Due: 31/01/2024. ELEMENT GEYSER. Seems to be local item; floated but could not find offer. May be rejected.')
  RETURNING id INTO rfq_fauji_geyser;

  -- 10. Fauji Cement – Air Filter Regulator
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_fauji, 'Fauji Cement', '2025-01-26', 0, admin_id, 'medium', 'quoted',
          'Received via email. Due: 29/01/2025. Air Filter Regulator. Already bided; sent offer again.')
  RETURNING id INTO rfq_fauji_air;

  -- 11. Fauji Cement – Manual Tender Motor
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_fauji, 'Fauji Cement', '2025-01-27', 0, admin_id, 'medium', 'quoted',
          'RFQ #1000003893. Due: 29/01/2025. Manual Tender-Motor. Already bided; sent offer again.')
  RETURNING id INTO rfq_fauji_motor;

  -- 12. Ghani Glass – Thermocouple Cable
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ghani, 'Ghani Glass', '2025-01-27', 0, admin_id, 'medium', 'in_progress',
          'Received via WhatsApp. Due: 05/02/2025. Thermocouple Cable. Supplier asked for technical info; waiting for client response.')
  RETURNING id INTO rfq_ghani_thermo;

  -- 13. Olympia Chemicals – YOKOGAWA pH Sensor (TOP PRIORITY)
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_olympia, 'Olympia Chemicals', '2025-01-29', 0, admin_id, 'high', 'in_progress',
          'Received via WhatsApp. Due: 05/02/2025. RFQ for YOKOGAWA pH Sensor. TOP PRIORITY – will bid on time.')
  RETURNING id INTO rfq_olympia_ph;

  -- 14. IFL Head Office – Portable pH/EC/TDS Meter HQ1110 (TOP PRIORITY)
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_ifl, 'IFL Head Office', '2025-01-30', 0, admin_id, 'high', 'in_progress',
          'RFQ #74037. Due: 05/02/2025. Portable pH/EC/TDS Meter (HQ1110) and Probes. TOP PRIORITY – offer received, will bid on time.')
  RETURNING id INTO rfq_ifl_hq1110;

  -- 15. Interloop – Process Automation RO Plants (TOP PRIORITY – Sajid working)
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_interloop, 'Interloop', '2025-01-30', 0, admin_id, 'high', 'in_progress',
          'Received via email. Due: 05/02/2025. Process Automation of Raw water direct feed to RO Plants. TOP PRIORITY – Sajid Sb is working on it.')
  RETURNING id INTO rfq_interloop_ro;

  -- 16. Fauji Cement – Temp Transmitter
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_fauji, 'Fauji Cement', '2025-01-31', 0, admin_id, 'medium', 'in_progress',
          'Received via email. Due: 07/02/2025. TEMP TRANSMITTER. Will bid on time.')
  RETURNING id INTO rfq_fauji_temp;

  -- 17. Fauji Cement – Gauges SOVs and Spares
  INSERT INTO rfqs (client_id, company_name, rfq_date, estimated_value, assigned_to, priority, status, notes)
  VALUES (c_fauji, 'Fauji Cement', '2025-01-31', 0, admin_id, 'medium', 'in_progress',
          'Received via email. Due: 06/02/2025. Gauges SOV''s and Spares. Will bid on time.')
  RETURNING id INTO rfq_fauji_gauges;

  RAISE NOTICE 'RFQs inserted: 17';

  -- ================================================================
  -- STEP 4: RFQ LINE ITEMS
  -- ================================================================

  INSERT INTO rfq_line_items (rfq_id, product_type, quantity, specification, target_price)
  VALUES
    (rfq_ifl_flowmeter,  'Flow Meter',         1, 'Compressed Air & Ultrasonic Flowmeters', NULL),
    (rfq_ghani_khi_prox, 'Proximity Switch',   1, 'Proximity Switches', NULL),
    (rfq_ifl_belimo,     'Valve/Actuator',     1, 'Belimo + Dwyer Valves', NULL),
    (rfq_fries_panel,    'Electrical Panel',   1, '11KV-MV Panels', NULL),
    (rfq_ifl_minebea,    'Sensor',             1, 'Minebea + CTS Components', NULL),
    (rfq_ghani_lhr_prox, 'Proximity Switch',   1, 'Proximity Switches and IC-14 Pin', NULL),
    (rfq_fries_ctrl,     'Controller',         1, 'Process Controller', NULL),
    (rfq_fries_flow,     'Flow Meter',         1, 'Flowmeters with Datalogging', NULL),
    (rfq_fauji_geyser,   'Heating Element',    1, 'Element Geyser (local item)', NULL),
    (rfq_fauji_air,      'Pneumatics',         1, 'Air Filter Regulator', NULL),
    (rfq_fauji_motor,    'Motor',              1, 'Manual Tender-Motor', NULL),
    (rfq_ghani_thermo,   'Thermocouple',       1, 'Thermocouple Cable', NULL),
    (rfq_olympia_ph,     'Analyser',           1, 'YOKOGAWA pH Sensor', NULL),
    (rfq_ifl_hq1110,     'Analyser',           1, 'Portable pH/EC/TDS Meter HQ1110 and Probes', NULL),
    (rfq_interloop_ro,   'Automation',         1, 'Process Automation – Raw water direct feed to RO Plants', NULL),
    (rfq_fauji_temp,     'Transmitter',        1, 'Temperature Transmitter', NULL),
    (rfq_fauji_gauges,   'Instrumentation',    1, 'Gauges, SOVs and Spares', NULL);

  RAISE NOTICE 'RFQ Line Items inserted: 17';

  -- ================================================================
  -- STEP 5: ORDERS (from PO Status sheet)
  -- order_value = Sales Invoice (billed to client, incl. GST)
  -- cost_value  = Total Landing Cost (supplier cost + freight + service)
  -- ================================================================

  -- 1. Ibrahim Fibres – PO 251809 – Wallmount Ultrasonic Flow Meter x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_meacon, admin_id, 'Flow Meter',
          370000, 87150, 'completed',
          'PO# 251809. Wallmount Ultrasonic Flow Meter x1. Received & delivered. Net Margin ≈ PKR 387,560.',
          '2024-10-11')
  RETURNING id INTO ord_ibr_251809;

  -- 2. Ibrahim Fibres – PO 252446 – Wallmount Ultrasonic Flow Meter x3
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_meacon, admin_id, 'Flow Meter',
          1244310, 387420, 'completed',
          'PO# 252446. Wallmount Ultrasonic Flow Meter x3. Received & delivered. Net Margin ≈ PKR 1,056,630.',
          NULL)
  RETURNING id INTO ord_ibr_252446;

  -- 3. FrieslandCampina – PO 225 – Portable Ultrasonic Flow Meter x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_friesland, v_meacon, admin_id, 'Flow Meter',
          240000, 159390, 'completed',
          'PO# 225. Portable Ultrasonic Flow Meter x1. Received, delivered & payment received.',
          '2024-10-11')
  RETURNING id INTO ord_fries_225;

  -- 4. Matco Foods – PO 010395-1 – Electromagnetic Flow Meter x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_matco, v_mc, admin_id, 'Flow Meter',
          355319, 261784, 'completed',
          'PO# 010395-1. Electromagnetic Flow Meter x1. M&C Strongman. Final remaining payment ≈ PKR 20,511 received 08-01-2025.',
          NULL)
  RETURNING id INTO ord_matco_flow;

  -- 5. Ibrahim Fibres – PO 248504/24850 – Compressed Air Filters x5
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_ewo, admin_id, 'Pneumatics / Air Filters',
          650163, 370000, 'completed',
          'PO# 248504 & 24850. Compressed Air Filters and Filter Inserts x5. ewo Germany. Received, delivered & payment received.',
          '2024-08-02')
  RETURNING id INTO ord_ibr_air;

  -- 6. Olympia Chemicals – PO PO250105 – Conductivity Meter & Sensor x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_olympia, v_heibi, admin_id, 'Analyser',
          212659, 116950, 'procurement',
          'PO# PO250105. Conductivity Meter & Sensor x1. Heibi Createc China. Received & arrangement for delivery in process.',
          NULL)
  RETURNING id INTO ord_olympia_cond;

  -- 7. Ibrahim Fibres – PO 252993 – Moxa Serial to Ethernet Converter x2
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_moxa, admin_id, 'Industrial Networking',
          73986, 50108, 'completed',
          'PO# 252993. Moxa Serial to Ethernet Converter x2. XIAMEN TONGKONG. Received & delivered.',
          NULL)
  RETURNING id INTO ord_ibr_252993;

  -- 8. Ibrahim Fibres – PO 253074 (batch A) – Moxa Serial to Ethernet Converter x2
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_moxa, admin_id, 'Industrial Networking',
          73986, 50108, 'completed',
          'PO# 253074 (Unit A). Moxa Serial to Ethernet Converter x2. XIAMEN TONGKONG. Received & delivered.',
          NULL)
  RETURNING id INTO ord_ibr_253074a;

  -- 9. Ibrahim Fibres – PO 253074 (batch B) – Moxa Serial to Ethernet Converter x2
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_moxa, admin_id, 'Industrial Networking',
          73986, 50108, 'completed',
          'PO# 253074 (Unit B). Moxa Serial to Ethernet Converter x2. XIAMEN TONGKONG. Received & delivered.',
          NULL)
  RETURNING id INTO ord_ibr_253074b;

  -- 10. Matco Foods – PO 010801-1 – Siemens S1500 CPU x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_matco, v_deao, admin_id, 'Automation / PLC',
          617258, 464712, 'completed',
          'PO# 010801-1. Siemens S1500 CPU x1. DEAO China (Siemens distributor). Received & delivered. Remaining receivable ≈ PKR 259,898.',
          '2024-10-07')
  RETURNING id INTO ord_matco_siemens;

  -- 11. FrieslandCampina – X-Ray Curtains x2
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_friesland, v_shandong, admin_id, 'Safety Equipment',
          290222, 238260, 'completed',
          'X-Ray Curtains x2. Shandong Schanghai. Received & delivered.',
          NULL)
  RETURNING id INTO ord_fries_xray;

  -- 12. Ghani Glass – PO 13378 – Magnetic Pickup Sensor x30 (NOTE: Loss order)
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ghani, v_redlion, admin_id, 'Sensor',
          403560, 535120, 'procurement',
          'PO# 13378. Magnetic Pickup Sensor x30. Red Lion USA (Four Stars). Order placed. WARNING: Margin negative – cost PKR 535,120 vs sale PKR 403,560 = LOSS of PKR 131,560.',
          '2024-11-11')
  RETURNING id INTO ord_ghani_sensor;

  -- 13. Ghani Glass – Converter Module x2
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ghani, v_redlion, admin_id, 'Converter Module',
          354236, 235600, 'procurement',
          'Converter Module x2. Red Lion USA (Four Stars). Order placed. Net Margin ≈ PKR 175,516.',
          '2024-11-11')
  RETURNING id INTO ord_ghani_conv;

  -- 14. Sapphire Finishing Mills – Position Transmitter x2 (batch A)
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_sapphire, v_goffran, admin_id, 'Position Transmitter',
          291175, 205430, 'procurement',
          'Position Transmitter Linear PMA-18-F0200-X L=200mm Transdecor F0200 x2. Goffran Italy (ECIS UAE). Order placed. Net Margin ≈ PKR 132,500.',
          '2024-11-11')
  RETURNING id INTO ord_sapphire_a;

  -- 15. Sapphire Finishing Mills – PO 90222 – Position Transmitter x2 (batch B)
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_sapphire, v_goffran, admin_id, 'Position Transmitter',
          293641, 205430, 'procurement',
          'PO# 90222. Position Transmitter Linear PMA-18-F0200-X L=200mm x2. Goffran Italy (ECIS UAE). Order placed.',
          '2024-11-11')
  RETURNING id INTO ord_sapphire_b;

  -- 16. FrieslandCampina – PO2224 – Siemens 11kV MV Panel x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_friesland, v_siemens, admin_id, 'Electrical Panel',
          1440000, 150000, 'completed',
          'PO# PO2224. Siemens 11kV MV Panel x1. Delivered. Net Margin ≈ PKR 590,000.',
          NULL)
  RETURNING id INTO ord_fries_panel;

  -- 17. Ibrahim Fibres – PO 254533 – Tecto Oxygen Sensor x1
  INSERT INTO orders (client_id, vendor_id, sales_person_id, product_type, order_value, cost_value, status, notes, confirmed_date)
  VALUES (c_ibrahim, v_tecto, admin_id, 'Sensor',
          160000, 125604, 'completed',
          'PO# 254533. Tecto Oxygen Sensor x1. Tecto China. Delivered.',
          '2024-12-03')
  RETURNING id INTO ord_ibr_oxygen;

  RAISE NOTICE 'Orders inserted: 17';

  -- ================================================================
  -- STEP 6: INVOICES (Sales invoices to clients)
  -- ================================================================

  INSERT INTO invoices (invoice_number, client_id, order_id, invoice_amount, issued_date, due_date, payment_status, amount_paid, payment_method, created_by, notes)
  VALUES
    ('INV-2024-001', c_ibrahim, ord_ibr_251809,  370000, '2024-10-11', '2024-11-10', 'Paid',    370000, 'Bank Transfer', admin_id, 'PO 251809. Wallmount Ultrasonic Flow Meter x1. Fully paid.'),
    ('INV-2024-002', c_ibrahim, ord_ibr_252446, 1244310, '2024-10-15', '2024-11-14', 'Paid',   1244310, 'Bank Transfer', admin_id, 'PO 252446. Wallmount Ultrasonic Flow Meter x3. Fully paid.'),
    ('INV-2024-003', c_friesland, ord_fries_225,  240000, '2024-10-11', '2024-11-10', 'Paid',   240000, 'Bank Transfer', admin_id, 'PO 225. Portable Ultrasonic Flow Meter x1. Fully paid.'),
    ('INV-2024-004', c_matco, ord_matco_flow,     355319, '2024-10-20', '2024-11-19', 'Paid',   355319, 'Bank Transfer', admin_id, 'PO 010395-1. EM Flow Meter. Final payment received 08-01-2025.'),
    ('INV-2024-005', c_ibrahim, ord_ibr_air,       650163, '2024-08-10', '2024-09-09', 'Paid',  650163, 'Bank Transfer', admin_id, 'PO 248504/24850. Compressed Air Filters x5. Fully paid.'),
    ('INV-2024-006', c_olympia, ord_olympia_cond,  212659, '2025-01-05', '2025-02-04', 'Pending',    0, 'Bank Transfer', admin_id, 'PO PO250105. Conductivity Meter. Awaiting delivery and payment.'),
    ('INV-2024-007', c_ibrahim, ord_ibr_252993,    73986, '2024-10-25', '2024-11-24', 'Paid',    73986, 'Bank Transfer', admin_id, 'PO 252993. Moxa Ethernet Converter x2. Received & delivered.'),
    ('INV-2024-008', c_ibrahim, ord_ibr_253074a,   73986, '2024-10-28', '2024-11-27', 'Paid',    73986, 'Bank Transfer', admin_id, 'PO 253074 (A). Moxa Ethernet Converter x2. Received & delivered.'),
    ('INV-2024-009', c_ibrahim, ord_ibr_253074b,   73986, '2024-10-30', '2024-11-29', 'Paid',    73986, 'Bank Transfer', admin_id, 'PO 253074 (B). Moxa Ethernet Converter x2. Received & delivered.'),
    ('INV-2024-010', c_matco, ord_matco_siemens,   617258, '2024-10-10', '2024-11-09', 'Partial', 357360, 'Bank Transfer', admin_id, 'PO 010801-1. Siemens S1500 CPU. Remaining receivable PKR 259,898.'),
    ('INV-2024-011', c_friesland, ord_fries_xray,  290222, '2024-10-20', '2024-11-19', 'Paid',  290222, 'Bank Transfer', admin_id, 'X-Ray Curtains x2. Fully paid.'),
    ('INV-2024-012', c_ghani, ord_ghani_sensor,    403560, '2024-11-15', '2024-12-15', 'Pending',    0, 'Bank Transfer', admin_id, 'PO 13378. Magnetic Pickup Sensor x30. Red Lion. Order placed – payment pending.'),
    ('INV-2024-013', c_ghani, ord_ghani_conv,      354236, '2024-11-15', '2024-12-15', 'Pending',    0, 'Bank Transfer', admin_id, 'Converter Module x2. Red Lion. Order placed – payment pending.'),
    ('INV-2024-014', c_sapphire, ord_sapphire_a,   291175, '2024-11-20', '2024-12-20', 'Pending',    0, 'Bank Transfer', admin_id, 'Position Transmitter x2 (batch A). Goffran Italy. Order placed.'),
    ('INV-2024-015', c_sapphire, ord_sapphire_b,   293641, '2024-11-20', '2024-12-20', 'Pending',    0, 'Bank Transfer', admin_id, 'PO 90222. Position Transmitter x2 (batch B). Goffran Italy. Order placed.'),
    ('INV-2024-016', c_friesland, ord_fries_panel, 1440000, '2024-12-01', '2025-01-01', 'Paid', 1440000, 'Bank Transfer', admin_id, 'PO2224. Siemens 11kV MV Panel. Delivered. Fully paid.'),
    ('INV-2024-017', c_ibrahim, ord_ibr_oxygen,    160000, '2024-12-05', '2025-01-04', 'Paid',  160000, 'Bank Transfer', admin_id, 'PO 254533. Tecto Oxygen Sensor. Delivered. Paid.');

  RAISE NOTICE 'Invoices inserted: 17';

  -- ================================================================
  -- STEP 7: EXPENSES (Supplier / procurement costs)
  -- ================================================================

  INSERT INTO expenses (date, amount, category, description, vendor_id, order_id, created_by, notes)
  VALUES
    ('2024-10-11', 87150,  'Inventory/Procurement', 'PO 251809 – Wallmount Ultrasonic Flow Meter x1 (RST Turkey/Meacon)', v_meacon,   ord_ibr_251809,  admin_id, 'Cost: supplier 73,800 + freight 12,600 + service 750'),
    ('2024-10-15', 387420, 'Inventory/Procurement', 'PO 252446 – Wallmount Ultrasonic Flow Meter x3 (RST Turkey/Meacon)', v_meacon,   ord_ibr_252446,  admin_id, 'Cost: supplier 295,200 + freight 62,700 + service 23,520'),
    ('2024-10-11', 159390, 'Inventory/Procurement', 'PO 225 – Portable Ultrasonic Flow Meter x1 (RST Turkey/Meacon)',    v_meacon,   ord_fries_225,   admin_id, 'Cost: supplier 118,300 + freight 39,300 + service 1,190'),
    ('2024-10-20', 261784, 'Inventory/Procurement', 'PO 010395-1 – EM Flow Meter x1 (M&C Strongman)',                   v_mc,       ord_matco_flow,  admin_id, 'Cost: supplier 158,014 + freight 88,200 + service 15,570'),
    ('2024-08-02', 370000, 'Inventory/Procurement', 'PO 248504 – Compressed Air Filters x5 (ewo Germany)',              v_ewo,      ord_ibr_air,     admin_id, 'Cost: supplier 261,062 + freight 108,938'),
    ('2025-01-05', 116950, 'Inventory/Procurement', 'PO PO250105 – Conductivity Meter x1 (Heibi Createc China)',        v_heibi,    ord_olympia_cond, admin_id, 'Cost: supplier 102,500 + freight 4,200 + service 10,250'),
    ('2024-10-25', 50108,  'Inventory/Procurement', 'PO 252993 – Moxa Ethernet Converter x2 (XIAMEN TONGKONG)',         v_moxa,     ord_ibr_252993,  admin_id, 'Cost: supplier 44,280 + freight 1,400 + service 4,428'),
    ('2024-10-28', 50108,  'Inventory/Procurement', 'PO 253074 (A) – Moxa Ethernet Converter x2 (XIAMEN TONGKONG)',     v_moxa,     ord_ibr_253074a, admin_id, 'Cost: supplier 44,280 + freight 1,400 + service 4,428'),
    ('2024-10-30', 50108,  'Inventory/Procurement', 'PO 253074 (B) – Moxa Ethernet Converter x2 (XIAMEN TONGKONG)',     v_moxa,     ord_ibr_253074b, admin_id, 'Cost: supplier 44,280 + freight 1,400 + service 4,428'),
    ('2024-10-07', 464712, 'Inventory/Procurement', 'PO 010801-1 – Siemens S1500 CPU x1 (DEAO China)',                  v_deao,     ord_matco_siemens, admin_id, 'Cost: supplier 426,400 + freight 4,200 + service 34,112'),
    ('2024-10-20', 238260, 'Inventory/Procurement', 'X-Ray Curtains x2 (Shandong Schanghai)',                           v_shandong, ord_fries_xray,  admin_id, 'Cost: supplier 174,600 + freight 46,200 + service 17,460'),
    ('2024-11-11', 535120, 'Inventory/Procurement', 'PO 13378 – Magnetic Pickup Sensor x30 (Red Lion USA/Four Stars)',  v_redlion,  ord_ghani_sensor, admin_id, 'Cost: supplier 540,120 + freight 27,500 – adjustment. WARNING: Loss order.'),
    ('2024-11-11', 235600, 'Inventory/Procurement', 'Converter Module x2 (Red Lion USA/Four Stars)',                    v_redlion,  ord_ghani_conv,  admin_id, 'Cost: supplier 180,600 + freight 27,500 + service 27,500'),
    ('2024-11-11', 205430, 'Inventory/Procurement', 'Position Transmitter x2 batch A (Goffran Italy/ECIS UAE)',         v_goffran,  ord_sapphire_a,  admin_id, 'Cost: supplier 116,600 + freight 20,000 + service 8,830'),
    ('2024-11-11', 205430, 'Inventory/Procurement', 'PO 90222 – Position Transmitter x2 batch B (Goffran Italy)',       v_goffran,  ord_sapphire_b,  admin_id, 'Cost: supplier 116,600 + freight 20,000 + service 8,830'),
    ('2024-12-01', 150000, 'Inventory/Procurement', 'PO2224 – Siemens 11kV MV Panel x1 (Siemens Direct)',               v_siemens,  ord_fries_panel, admin_id, 'Cost: supplier 150,000 + freight 50,000 = 200,000 total landing'),
    ('2024-12-03', 125604, 'Inventory/Procurement', 'PO 254533 – Tecto Oxygen Sensor x1 (Tecto China)',                 v_tecto,    ord_ibr_oxygen,  admin_id, 'Cost: supplier 125,604 + freight 13,856');

  RAISE NOTICE 'Expenses inserted: 17';

  -- ================================================================
  -- STEP 8: PAYABLES (Remaining payments owed to suppliers)
  -- ================================================================

  -- Only include orders with outstanding supplier payments (where remaining PO payment > 0)
  -- Based on the Excel data, most completed orders are fully paid to suppliers
  -- Including a few that show partial/pending supplier payments

  INSERT INTO payables (vendor_id, amount, due_date, payment_status, amount_paid, invoice_reference, created_by)
  VALUES
    -- Ghani Glass sensor order – supplier paid but client receivable pending
    (v_redlion, 535120, '2024-12-15', 'Paid', 535120, 'PO-13378-Ghani-Sensor', admin_id),
    (v_redlion, 235600, '2024-12-15', 'Paid', 235600, 'PO-Ghani-Converter', admin_id),
    -- Sapphire orders – placed, supplier payment pending
    (v_goffran, 205430, '2024-12-31', 'Pending', 0, 'PO-Sapphire-A', admin_id),
    (v_goffran, 205430, '2024-12-31', 'Pending', 0, 'PO-90222-Sapphire-B', admin_id),
    -- Olympia order – delivery in process
    (v_heibi,  116950, '2025-02-15', 'Pending', 0, 'PO-PO250105-Olympia', admin_id);

  RAISE NOTICE 'Payables inserted: 5';

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE '  Clients:       11';
  RAISE NOTICE '  Vendors:       11';
  RAISE NOTICE '  RFQs:          17';
  RAISE NOTICE '  RFQ LineItems: 17';
  RAISE NOTICE '  Orders:        17';
  RAISE NOTICE '  Invoices:      17';
  RAISE NOTICE '  Expenses:      17';
  RAISE NOTICE '  Payables:       5';
  RAISE NOTICE '====================================================';

END $$;
