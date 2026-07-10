# Row Level Security (RLS) Policies Explained

## Overview

Row Level Security (RLS) is a database-level feature that prevents unauthorized access to data. Even if someone has your Supabase anon key, they can only see rows that match their security policy.

**Current Status**: 🔴 DISABLED (must be enabled before production)

---

## The Problem We're Solving

### Before RLS (Current Situation - VULNERABLE)
```
User A (Sales)              User B (Admin)
    │                            │
    └──────────┬─────────────────┘
               │
        Anon Key exposure
               │
        ┌──────▼──────────────────────────────┐
        │ Supabase Database (No RLS)          │
        │                                      │
        │ SELECT * FROM invoices               │
        │ ├─ User A's invoices                 │
        │ ├─ User B's invoices                 │
        │ ├─ All client data                   │
        │ ├─ All order data                    │
        │ └─ All vendor data                   │
        │                                      │
        │ → Anyone with anon key can read ALL! │
        └──────────────────────────────────────┘
```

### After RLS (Secure)
```
User A (Sales)              User B (Admin)
    │                            │
    └──────────┬─────────────────┘
               │
        Anon Key exposure
               │
        ┌──────▼──────────────────────────────┐
        │ Supabase Database (RLS ENABLED)     │
        │                                      │
        │ User A can see:                      │
        │ ├─ Own profile                       │
        │ ├─ Client list (read-only)           │
        │ ├─ RFQs created by User A            │
        │ ├─ Orders created by User A          │
        │ └─ ❌ CANNOT see invoices             │
        │                                      │
        │ User B (Admin) can see:              │
        │ ├─ All users                         │
        │ ├─ All clients                       │
        │ ├─ All invoices                      │
        │ ├─ All orders                        │
        │ └─ All financial data                │
        │                                      │
        │ → Each user sees only allowed data   │
        └──────────────────────────────────────┘
```

---

## Role-Based Access Matrix

Here's exactly what each role can see/do with RLS enabled:

### USERS Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read own profile | ✅ | ✅ | ✅ |
| Read all profiles | ✅ | ❌ | ❌ |
| Update own profile | ✅ | ✅ | ✅ |
| Update other users | ✅ | ❌ | ❌ |
| Create new users | ✅ | ❌ | ❌ |

**Policy**: `role = auth.user.role` (read own) OR `role = 'admin'` (read all)

---

### CLIENTS Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read all | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ❌ |
| Update | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ |

**Policy**: All authenticated users can read (shared across company)  
Admin only can modify

---

### RFQs Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read all | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Update own | ✅ | ✅ | ❌ |
| Update others | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ |

**Policy**: Sales can create and update own RFQs  
All authenticated users can read (shared pipeline visibility)  
Admin can do anything

---

### ORDERS Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read all | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ✅ |
| Update own | ✅ | ✅ | ✅ |
| Update others | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ |

**Policy**: Anyone can create/update own orders  
Everyone can read all (visibility across team)  
Admin can modify any

---

### INVOICES Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read all | ✅ | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ |
| Update | ✅ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ |

**Policy**: Admin only  
Sales and Engineers cannot see financial data

---

### EXPENSES Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read all | ✅ | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ |
| Update | ✅ | ❌ | ❌ |

**Policy**: Admin only  
Cannot be deleted (audit trail)

---

### FOLLOW_UP_ACTIONS Table

| Action | Admin | Sales | Engineer |
|--------|-------|-------|----------|
| Read own | ✅ | ✅ | ✅ |
| Read all | ✅ | ❌ | ❌ |
| Create for self | ✅ | ✅ | ✅ |
| Create for others | ✅ | ❌ | ❌ |
| Update own | ✅ | ✅ | ✅ |
| Update others | ✅ | ❌ | ❌ |

**Policy**: Users can see/modify own actions  
Admin can see/modify any

---

## How RLS Works Technically

### Step 1: Authentication
When user logs in via Supabase Auth:
```
POST https://api.supabase.co/auth/v1/token
Body: { email, password }

Response:
{
  "access_token": "eyJhbG...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "app_metadata": { "role": "sales" }
  }
}
```

### Step 2: Session Established
Browser stores JWT token in secure session. Every API call includes token.

### Step 3: Query Execution
When app runs: `SELECT * FROM rfqs`

Supabase:
1. Extracts `auth.uid()` from JWT (e.g., `550e8400...`)
2. Extracts `auth.role()` from token (e.g., `sales`)
3. Checks RLS policy: `created_by = auth.uid() OR role = 'admin'`
4. Returns only matching rows

### Step 4: Policy Enforcement
```sql
-- RFQs policy: Users can see all, but only modify own
CREATE POLICY "Users can select RFQs" ON rfqs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create RFQs" ON rfqs
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales') AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update own RFQs" ON rfqs
  FOR UPDATE USING (
    created_by = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

---

## Practical Examples

### Example 1: Sales User Trying to Read Invoices

**Scenario**: User with role='sales' tries:
```javascript
const { data } = await supabase
  .from('invoices')
  .select('*');
```

**What Happens**:
1. App sends JWT with `auth.uid()` and `role='sales'`
2. Database checks policy: `role = 'admin'` (from CREATE POLICY)
3. User's role is 'sales', not 'admin'
4. ❌ Zero rows returned (appears empty)

**Note**: No error thrown - just silently no data (security through obscurity)

---

### Example 2: Sales User Creating RFQ

**Scenario**: User with id='550e84...' and role='sales' creates RFQ:
```javascript
const { data } = await supabase
  .from('rfqs')
  .insert({
    client_id: 'client1',
    estimated_value: 100000,
    created_by: '550e84...'
  });
```

**What Happens**:
1. App sends JWT with `auth.uid()='550e84...'` and `role='sales'`
2. Database checks policy: `created_by = auth.uid() AND role IN ('admin', 'sales')`
3. `created_by = '550e84...'` ✅ matches
4. `role = 'sales'` ✅ in list
5. ✅ Insert succeeds

---

### Example 3: Hacker With Old Anon Key

**Scenario**: Attacker has old anon key, tries:
```javascript
const anon = supabase.createClient(url, OLD_ANON_KEY);
const { data } = await anon
  .from('invoices')
  .select('*');
```

**What Happens**:
1. Old anon key is no longer valid (we rotated it)
2. Supabase rejects request: "Invalid API key"
3. ❌ No data returned

**If they somehow got a current key**:
1. Request has `auth.uid() = null` (anon has no user)
2. Database checks policy: `role = 'admin'`
3. Anon has no role
4. ❌ Zero rows returned

---

## Testing RLS Policies

### Test 1: Verify RLS is Enabled
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- All should show rowsecurity = t (true)
```

### Test 2: Test as Specific User
In Supabase SQL Editor, impersonate a user:
```sql
-- Set user context
SELECT set_config('request.jwt.claims', 
  json_build_object('sub', 'USER_ID_HERE', 'role', 'sales')::text, 
  true
);

-- Now queries run as that user
SELECT * FROM rfqs;  -- Should only show their RFQs
```

### Test 3: Test as Admin
```sql
SELECT set_config('request.jwt.claims', 
  json_build_object('sub', 'ADMIN_ID', 'role', 'admin')::text, 
  true
);

SELECT * FROM invoices;  -- Admin should see all
```

---

## Troubleshooting RLS Issues

### Issue 1: Legitimate User Can't See Data
**Symptom**: User logs in but invoices are empty

**Diagnosis**:
1. Check user's role in database:
   ```sql
   SELECT id, email, role FROM users WHERE id = auth.uid();
   ```
2. Check RLS policy on table:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'invoices';
   ```

**Solution**:
- If policy is too restrictive, update it
- If user's role is wrong, update the users table
- Refresh browser (clear JWT cache)

---

### Issue 2: Admin Can't Insert Users
**Symptom**: Admin can read users but can't create new ones

**Diagnosis**:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'users' 
AND policyname LIKE '%insert%';
```

**Solution**:
Check that policy allows:
```sql
-- Should have a policy like:
CREATE POLICY "Admin can insert users" ON users
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

---

### Issue 3: "Insufficient Privilege" Error
**Symptom**: Getting error when trying to update/delete

**Causes**:
1. User doesn't have UPDATE/DELETE permission in RLS
2. RLS policy syntax is wrong
3. User's id doesn't match `created_by` field

**Solution**:
1. Verify the RLS policy exists
2. Check user's actual role vs policy requirement
3. Check that `created_by` or other fields match the user

---

## Migration Notes

### From No RLS to RLS Enabled

**Important**: When RLS is first enabled with policies:

1. All SELECT queries still work (most policies allow authenticated users to read)
2. INSERT/UPDATE/DELETE may fail if policies are restrictive
3. Test with each role before going live

**Recommended testing order**:
1. Enable RLS on `clients` table (read-only for most)
2. Enable RLS on `rfqs` table (read all, create own)
3. Enable RLS on `orders` table (read all, create own)
4. Enable RLS on `invoices` table (admin only)
5. Iteratively test and fix

---

## Reference: All Policies By Table

| Table | Policies | Admin | Sales | Engineer |
|-------|----------|-------|-------|----------|
| users | 6 | RW | R self | R self |
| clients | 4 | RW | R | R |
| prospects | 4 | RW | RW | R |
| vendors | 4 | RW | R | R |
| rfqs | 4 | RW | RW own | R |
| orders | 4 | RW | RW own | RW own |
| invoices | 2 | RW | - | - |
| expenses | 2 | RW | - | - |
| supplier_inquiries | 3 | RW | RW own | R |
| supplier_quotes | 3 | RW | RW own | R |
| rfq_line_items | 3 | RW | RW | R |
| follow_up_actions | 3 | RW | RW own | RW own |
| payment_records | 2 | RW | - | - |
| payables | 3 | RW | - | - |

**Legend**: R=Read, W=Write, RW=Read+Write, - = No access

---

## Best Practices

1. **Test every role** before production
2. **Start restrictive** - better to be safe
3. **Add transparency** - show users what they can access
4. **Document policies** - keep this guide updated
5. **Audit quarterly** - review as features change
6. **Log access** - Supabase logs all RLS denials
7. **Never bypass** - don't use service role key in client app

---

## Summary

With RLS enabled:
- ✅ Passwords hashed by Supabase Auth
- ✅ Users isolated at database layer
- ✅ Anon key exposure less critical
- ✅ Role-based access enforced
- ✅ Audit trail maintained
- ✅ Compliance-ready (data isolation)

**Status**: 🟢 Ready to implement  
**Testing**: Critical before production  
**Impact**: High security improvement
