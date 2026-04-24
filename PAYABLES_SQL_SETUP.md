# 🔧 PAYABLES TABLE SQL SETUP

## SQL REQUIRED FOR PAYABLES TO WORK

Copy and paste the following SQL into your Supabase SQL Editor to create the payables table needed for Phase 2 Payables Management.

---

## CREATE PAYABLES TABLE

```sql
-- Create payables table for Accounts Payable tracking
CREATE TABLE IF NOT EXISTS payables (
  payable_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (payment_status IN ('Pending', 'Paid', 'Overdue', 'Partial')),
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0 AND amount_paid <= amount),
  payment_date DATE,
  invoice_reference VARCHAR(100),
  payment_method VARCHAR(50),
  linked_expense_id UUID REFERENCES expenses(expense_id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP,
  notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_payables_vendor_id ON payables(vendor_id);
CREATE INDEX idx_payables_due_date ON payables(due_date);
CREATE INDEX idx_payables_payment_status ON payables(payment_status);
CREATE INDEX idx_payables_created_at ON payables(created_at DESC);
CREATE INDEX idx_payables_linked_expense ON payables(linked_expense_id);

-- Enable RLS (Row Level Security)
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin can see all payables
CREATE POLICY payables_admin_select ON payables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Admin can insert
CREATE POLICY payables_admin_insert ON payables
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Admin can update
CREATE POLICY payables_admin_update ON payables
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Admin can delete
CREATE POLICY payables_admin_delete ON payables
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON payables TO authenticated;
```

---

## STEP-BY-STEP SETUP INSTRUCTIONS

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the SQL**
   - Copy the entire SQL script above

4. **Paste and Execute**
   - Paste into the SQL editor
   - Click "Run" button
   - Wait for "Success" message

5. **Verify the Table**
   - Go to "Table Editor" in sidebar
   - You should see "payables" table listed
   - Click to view the table structure

---

## QUICK REFERENCE: PAYABLES TABLE STRUCTURE

| Column | Type | Notes |
|--------|------|-------|
| payable_id | UUID | Primary key, auto-generated |
| vendor_id | UUID | Links to vendors table (required) |
| amount | NUMERIC | Payment amount, must be > 0 |
| due_date | DATE | When payment is due |
| payment_status | VARCHAR | Pending, Paid, Overdue, or Partial |
| amount_paid | NUMERIC | How much has been paid (auto-calculated) |
| payment_date | DATE | When payment was made |
| invoice_reference | VARCHAR | Vendor's invoice number (optional) |
| payment_method | VARCHAR | Bank Transfer, Check, Cash, etc. |
| linked_expense_id | UUID | Links to expenses table (optional) |
| created_by | UUID | User who created the payable |
| created_at | TIMESTAMP | When payable was created |
| updated_by | UUID | Last user to update |
| updated_at | TIMESTAMP | Last update time |
| notes | TEXT | Additional notes |

---

## CONSTRAINTS

✅ **amount** must be > 0  
✅ **amount_paid** must be ≤ **amount**  
✅ **payment_status** must be one of: Pending, Paid, Overdue, Partial  
✅ **vendor_id** must reference existing vendor  
✅ **created_by** must reference existing user  

---

## AFTER SETUP

Once the table is created, you can immediately:

1. **Create Payables**
   - Go to Bookkeeping → Payables tab
   - Click "Create Payable"
   - Select vendor, enter amount, set due date

2. **Record Payments**
   - Click the payment icon (💲) on any payable
   - Enter payment amount and date
   - Status updates automatically

3. **View AP Aging**
   - Go to Bookkeeping → A/P Aging tab
   - See payables bucketed by age
   - View outstanding amounts

4. **Track AP Metrics**
   - Dashboard shows total outstanding AP
   - Payables appear in DashboardMetrics
   - Export payables data via reports

---

## TROUBLESHOOTING

### Error: "relation 'vendors' does not exist"
**Solution:** Ensure vendors table is created first. Run the main BOOKKEEPING_SETUP.md script.

### Error: "relation 'expenses' does not exist"
**Solution:** Ensure expenses table is created first. Run the main BOOKKEEPING_SETUP.md script.

### Error: "permission denied for schema public"
**Solution:** You may need admin privileges. Log in with your Supabase admin account.

### Payables not showing in the app
**Solution:** 
1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh the page
3. Verify RLS policies are enabled
4. Check that you're logged in as admin

### Can't create a payable
**Solution:**
1. Verify you're logged in as admin
2. Ensure at least one vendor exists
3. Check browser console for errors (F12)
4. Verify amount > 0

---

## NEXT STEPS

After creating the payables table:

1. **Create Sample Data**
   ```
   - Create a vendor
   - Create a payable for that vendor
   - Record a payment
   - Verify status changes to "Partial"
   ```

2. **Test AP Aging**
   ```
   - Create payables with various due dates
   - View A/P Aging tab
   - Verify buckets show correctly
   ```

3. **Check Dashboard**
   ```
   - Outstanding AP should show on dashboard
   - Metrics should update automatically
   ```

---

## ADDITIONAL SQL (IF NEEDED)

### View All Payables
```sql
SELECT * FROM payables ORDER BY due_date DESC;
```

### View Outstanding Payables Only
```sql
SELECT * FROM payables 
WHERE payment_status IN ('Pending', 'Partial', 'Overdue')
ORDER BY due_date;
```

### View Payables by Vendor
```sql
SELECT p.*, v.name as vendor_name
FROM payables p
JOIN vendors v ON p.vendor_id = v.id
ORDER BY p.due_date DESC;
```

### Reset All Payables (if needed for testing)
```sql
DELETE FROM payables;
```

---

**Payables management is ready to go once this table is created!** ✅

