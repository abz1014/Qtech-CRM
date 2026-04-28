# 🔒 CRITICAL SECURITY SETUP - Required Before Production

This guide outlines the essential security fixes that **MUST** be completed before deploying to production. The previous security audit identified critical vulnerabilities that could expose all company data.

**Status**: ⚠️ BLOCKING - Do not deploy without completing these steps.

---

## Overview of Changes Made

The codebase has been updated with the following security fixes:

### ✅ Completed (Code Changes)
1. **AuthContext**: Switched from plaintext password comparison to Supabase Auth's `signInWithPassword()`
2. **Login Page**: Added input validation with Zod (email format, password length)
3. **CSV Export**: Added sanitization to prevent formula injection attacks
4. **Security Headers**: Added CSP, HSTS, and other protective headers to vercel.json
5. **RLS Policies**: Created comprehensive SQL script for row-level security

### ⚠️ Manual Steps Required (Must complete before deployment)
1. Rotate Supabase anon key
2. Migrate existing users to Supabase Auth
3. Delete plaintext password column
4. Enable RLS on all tables
5. Apply RLS policies

---

## Phase 1: Rotate Supabase Anon Key ⚡

### Why This Matters
The current anon key was exposed in network logs and browser history. A new user might have intercepted it. Rotating it invalidates the old key.

### Steps

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: **vptyhluvgnjpvkcbhxsf**
3. Navigate to **Settings → API**
4. Under "Project API keys", find your **anon (public)** key
5. Click the **three-dot menu** next to it → **Rotate key**
6. Confirm the rotation
7. **Copy the new anon key**
8. Update your `.env.local` file:
   ```env
   VITE_SUPABASE_URL=https://vptyhluvgnjpvkcbhxsf.supabase.co
   VITE_SUPABASE_ANON_KEY=<NEW_KEY_HERE>
   ```
9. Commit and redeploy to Vercel

---

## Phase 2: Migrate Users to Supabase Auth 🔐

### Background
Currently, user passwords are stored as plaintext in the `users` table. Supabase Auth handles password hashing securely. We need to migrate each user account.

### For Each User Account:

**Via Supabase Dashboard:**

1. Go to [Supabase Dashboard](https://app.supabase.com) → Your project → **Authentication → Users**
2. Click **"Create new user"**
3. Enter the user's email (must match the `users.email` value)
4. Set a **temporary password** (user must change on first login)
5. Click **"Create user"**
6. Note the **User ID** (UUID)

**Update the users Table:**

1. In Supabase, go to **SQL Editor**
2. Run this query for each user (replace the values):
   ```sql
   UPDATE users
   SET id = '<USER_UUID_FROM_AUTH>'
   WHERE email = 'user@example.com';
   ```
   Example:
   ```sql
   UPDATE users
   SET id = '550e8400-e29b-41d4-a716-446655440000'
   WHERE email = 'abdullahsajid772@gmail.com';
   ```

3. Verify the update:
   ```sql
   SELECT id, email, role FROM users;
   ```

### After Migration
- Users will be in the Supabase Auth system (with hashed passwords)
- Their profiles remain in the `users` table linked by UUID
- The login page now uses Supabase Auth
- Passwords are never stored in plaintext

---

## Phase 3: Enable Row Level Security (RLS) 🛡️

### Background
RLS ensures that even with a compromised anon key, users can only access their own data. Currently, RLS is disabled on all tables.

### Steps

1. In Supabase Dashboard, go to **SQL Editor**
2. Copy the entire contents of this file: `supabase/migrations/enable_rls_security_policies.sql`
3. Paste it into the SQL Editor
4. Click **"Run"** (this will take 1-2 minutes)
5. Check for any errors in the output

### Verification

Run this query to confirm RLS is enabled:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'users', 'clients', 'prospects', 'vendors', 'orders', 'order_engineers',
  'rfqs', 'supplier_inquiries', 'supplier_quotes', 'rfq_line_items',
  'invoices', 'expenses', 'payment_records', 'payables', 'payable_payments',
  'follow_up_actions'
);
```

**Expected output**: All rows should have `rowsecurity = t` (true)

---

## Phase 4: Remove Plaintext Password Column 🗑️

Once all users are migrated to Supabase Auth, the password column in the `users` table is no longer needed and represents a security risk.

### Steps

1. In Supabase Dashboard, go to **SQL Editor**
2. Run:
   ```sql
   ALTER TABLE users DROP COLUMN password;
   ```
3. Verify by checking the users table schema (should no longer have a password column)

---

## Phase 5: Test the New Login System 🧪

### Local Testing

1. Stop your dev server
2. Update `.env.local` with the new anon key:
   ```env
   VITE_SUPABASE_URL=https://vptyhluvgnjpvkcbhxsf.supabase.co
   VITE_SUPABASE_ANON_KEY=<NEW_ROTATED_KEY>
   ```
3. Restart the dev server: `npm run dev`
4. Go to `http://localhost:5173/login`
5. Try logging in with a test user:
   - Email: `abdullahsajid772@gmail.com` (or your test email)
   - Password: The **temporary password** you set during user creation
6. You should be directed to the dashboard
7. The user will be prompted to change their password on first login (optional feature to add)

### Deployed Testing

1. Push your changes to GitHub
2. Vercel will auto-deploy
3. Wait for deployment to complete
4. Go to your deployed URL (e.g., `https://your-app.vercel.app/login`)
5. Test login with your credentials
6. Verify you can access all pages

---

## Phase 6: Add More Users 👥

Once the system is running with Supabase Auth:

### For Admins Adding New Users

**Note**: This feature should only be available to admins. Currently, there's no UI for admin user management. You can:

**Option A: Via Supabase Dashboard (for now)**
- Same steps as "Phase 2: Migrate Users to Supabase Auth"
- Create the Supabase Auth user
- Add the user's profile to the `users` table with their UUID

**Option B: Build an Admin User Management Page (Future)**
- Create a form that only admins can access
- Call `supabase.auth.admin.createUser()` (server-side only!)
- Insert the user profile into the `users` table

---

## Checklist for Deployment ✅

Before deploying to production, verify:

- [ ] Anon key has been rotated
- [ ] All users migrated to Supabase Auth (with UUIDs matching)
- [ ] Plaintext password column removed
- [ ] RLS enabled on all tables
- [ ] RLS policies applied successfully
- [ ] Login tested locally
- [ ] Login tested on deployed app
- [ ] New CSP headers deployed (vercel.json updated)
- [ ] All team members can log in with their credentials

---

## What Was Fixed (P0 Vulnerabilities)

### ❌ Before
- ✗ Passwords stored as plaintext in database
- ✗ Passwords transmitted in URL query params (visible in browser history, server logs)
- ✗ RLS disabled - anyone with anon key could read/write all data
- ✗ No input validation - XSS and injection vulnerabilities
- ✗ CSV exports could contain formulas (formula injection)
- ✗ No security headers - vulnerable to clickjacking, MIME sniffing
- ✗ Client-side authentication only - role spoofing possible

### ✅ After
- ✓ Passwords hashed by Supabase Auth (bcrypt)
- ✓ Passwords sent in POST body (TLS encrypted)
- ✓ RLS enforces row-level access control
- ✓ Zod validation on all forms
- ✓ CSV cells sanitized against formula injection
- ✓ CSP, HSTS, X-Frame-Options headers added
- ✓ Server-side RLS policies enforce role-based access

---

## Troubleshooting

### Users Can't Log In After Changes

**Symptom**: "Invalid email or password"

**Solutions**:
1. Verify the user exists in Supabase Auth (Settings → Authentication → Users)
2. Verify the user's UUID matches the `users.id` in the database
3. Check that the new anon key is in your `.env.local`
4. Try resetting the user's password in Supabase Dashboard

### RLS Policies Block Data Access

**Symptom**: "Insufficient privilege" errors

**Solutions**:
1. Verify RLS is properly enabled on the table
2. Check the RLS policy syntax (especially auth.uid() vs auth.user_id())
3. Verify the auth.uid() matches a user's ID in the users table
4. Test with a simple SELECT policy first before complex rules

### CSP Headers Blocking Resources

**Symptom**: Console shows CSP violations

**Solutions**:
1. Check the `vercel.json` CSP policy
2. Add new domains to appropriate directives (script-src, style-src, etc.)
3. Never use `unsafe-eval` or `unsafe-inline` except where absolutely necessary

---

## Security Best Practices Going Forward

1. **Never commit credentials** - Always use environment variables
2. **Rotate keys regularly** - At least quarterly
3. **Monitor auth logs** - Watch for failed login attempts
4. **Keep Supabase updated** - Subscribe to security bulletins
5. **Audit RLS policies** - Review quarterly for new features/tables
6. **Input validation** - Always validate on both client and server
7. **Password requirements** - Consider adding strength requirements

---

## Questions?

If you encounter issues or have questions:

1. Check the [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
2. Review the RLS policies in `supabase/migrations/enable_rls_security_policies.sql`
3. Check browser console for error messages
4. Verify all .env variables are set correctly

---

**Last Updated**: 2026-04-28
**Status**: Ready to Deploy ✅
