# 🚀 DEPLOYMENT CHECKLIST

**Status**: 🔴 BLOCKED - Cannot deploy without security fixes  
**Time Required**: 1-2 hours  
**Approval**: Required before going live

---

## Pre-Deployment Security Audit

This checklist verifies that all critical security fixes have been implemented and tested.

### Section 1: Code Changes ✅ (Already Done)

Code changes have been implemented:

- [x] AuthContext.tsx - Switched to Supabase Auth
- [x] LoginPage.tsx - Added input validation
- [x] DailyRFQReportPage.tsx - Added CSV sanitization
- [x] App.tsx - Added auth loading state
- [x] vercel.json - Added security headers
- [x] RLS policies SQL - Created comprehensive policies

**Status**: ✅ Complete - No code changes needed

---

### Section 2: Supabase Configuration ⏳ (Manual - Required)

Follow these steps in Supabase Dashboard.

#### 2.1: Rotate Anon Key 🔴 CRITICAL

- [ ] Go to: https://app.supabase.com/project/vptyhluvgnjpvkcbhxsf/settings/api
- [ ] Click menu next to anon (public) key
- [ ] Select "Rotate key"
- [ ] Confirm rotation
- [ ] Copy new anon key
- [ ] Update `.env.local`:
  ```env
  VITE_SUPABASE_ANON_KEY=<NEW_KEY_HERE>
  ```

**Verification**: Try to use old key - should be rejected

---

#### 2.2: Migrate Users to Supabase Auth 🔴 CRITICAL

For **each user**:

**User 1: abdullahsajid772@gmail.com**
- [ ] Create in Supabase Auth (Auth → Users → Create new user)
- [ ] Set temporary password: `TempPass123!`
- [ ] Get User UUID from Auth
- [ ] Run SQL:
  ```sql
  UPDATE users
  SET id = '<USER_UUID>'
  WHERE email = 'abdullahsajid772@gmail.com';
  ```
- [ ] Verify:
  ```sql
  SELECT id, email FROM users WHERE email = 'abdullahsajid772@gmail.com';
  ```
- [ ] Test login: ✅ Works

**User 2: [EMAIL]**
- [ ] Create in Supabase Auth
- [ ] Get User UUID
- [ ] Update users table
- [ ] Test login: ✅ Works

**User 3: [EMAIL]**
- [ ] Create in Supabase Auth
- [ ] Get User UUID
- [ ] Update users table
- [ ] Test login: ✅ Works

**Additional Users**: (repeat for each)
- [ ] User: _____________ - ✅ Migrated & tested
- [ ] User: _____________ - ✅ Migrated & tested
- [ ] User: _____________ - ✅ Migrated & tested

---

#### 2.3: Enable RLS on All Tables 🔴 CRITICAL

- [ ] Open Supabase SQL Editor
- [ ] Copy entire contents of file: `supabase/migrations/enable_rls_security_policies.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Wait for completion (1-2 minutes)
- [ ] Verify with:
  ```sql
  SELECT COUNT(*) as tables_with_rls FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  ```
- [ ] Should return: **16** tables with RLS enabled

**Verification Details**:
```sql
-- List all tables with RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected output: all should have rowsecurity = t
```

---

#### 2.4: Delete Plaintext Password Column 🟠 IMPORTANT

Only after all users migrated and tested:

- [ ] Open Supabase SQL Editor
- [ ] Run:
  ```sql
  ALTER TABLE users DROP COLUMN password;
  ```
- [ ] Verify column is deleted:
  ```sql
  SELECT * FROM users LIMIT 1;
  -- Should not have password column
  ```

---

### Section 3: Code Deployment 🟡 IMPORTANT

Prepare and deploy the code changes.

#### 3.1: Prepare Local Environment

- [ ] Pull latest code from GitHub
- [ ] Install dependencies: `npm install`
- [ ] Update `.env.local` with:
  ```env
  VITE_SUPABASE_URL=https://vptyhluvgnjpvkcbhxsf.supabase.co
  VITE_SUPABASE_ANON_KEY=<NEW_ROTATED_KEY>
  ```

#### 3.2: Test Locally

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to: http://localhost:5173
- [ ] Should redirect to login page
- [ ] Test login with each migrated user:
  - [ ] User 1: Email + password → ✅ Dashboard loads
  - [ ] User 2: Email + password → ✅ Dashboard loads
  - [ ] User 3: Email + password → ✅ Dashboard loads

#### 3.3: Verify Features Work

- [ ] Login with new auth system
- [ ] Page refresh keeps you logged in
- [ ] Logout works
- [ ] Redirect to login page when not authenticated
- [ ] CSV export works (check for errors)
- [ ] All pages load without console errors

#### 3.4: Check Security Headers

Open http://localhost:5173 in browser:

- [ ] Open DevTools (F12) → Network tab
- [ ] Check response headers for:
  ```
  Strict-Transport-Security: max-age=31536000...
  Content-Security-Policy: ...
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  ```

#### 3.5: Deploy to GitHub

- [ ] Stage all changes: `git add .`
- [ ] Create commit message:
  ```
  git commit -m "Security: Implement Supabase Auth, RLS, and security headers

  - Switch login to Supabase Auth (passwords now hashed)
  - Enable RLS on all tables (database-level access control)
  - Add input validation to forms
  - Sanitize CSV export (prevent formula injection)
  - Add security headers (CSP, HSTS, etc.)
  - Add auth loading state
  
  Fixes critical security vulnerabilities from audit."
  ```
- [ ] Push to GitHub: `git push`
- [ ] Monitor Vercel deployment

---

### Section 4: Production Deployment 🟢 IMPORTANT

#### 4.1: Vercel Deployment

- [ ] Vercel auto-deploys from GitHub
- [ ] Check Vercel dashboard for successful build
- [ ] Deployment should complete in 2-5 minutes
- [ ] No build errors
- [ ] No deployment errors

#### 4.2: Environment Variables

Verify environment variables in Vercel:

- [ ] Project → Settings → Environment Variables
- [ ] `VITE_SUPABASE_URL` = correct URL
- [ ] `VITE_SUPABASE_ANON_KEY` = NEW rotated key (not old one)
- [ ] No secrets in config

---

### Section 5: Production Testing 🟢 IMPORTANT

#### 5.1: Access Production App

- [ ] Navigate to: https://[your-app].vercel.app
- [ ] Should show login page (not error)

#### 5.2: Test Authentication

For each user:

- [ ] Test User 1:
  - [ ] Enter email: abdullahsajid772@gmail.com
  - [ ] Enter password: (their password)
  - [ ] Click Sign In
  - [ ] ✅ Dashboard loads
  - [ ] ✅ User name shows in header/profile

- [ ] Test User 2:
  - [ ] Login successful: ✅
  - [ ] Dashboard loads: ✅

- [ ] Test User 3:
  - [ ] Login successful: ✅
  - [ ] Dashboard loads: ✅

#### 5.3: Test Session Persistence

- [ ] Login to production app
- [ ] Refresh page (F5)
- [ ] ✅ Should stay logged in (not return to login)
- [ ] Logout works correctly

#### 5.4: Test App Features

- [ ] Can navigate all pages without errors
- [ ] CSV export works (download a report)
- [ ] No console errors (Open DevTools)
- [ ] Security headers present (DevTools → Network)

#### 5.5: Security Verification

- [ ] Browser console shows no errors
- [ ] Supabase logs show successful auth (check in Supabase Dashboard)
- [ ] No failed login attempts from unauthorized sources
- [ ] API calls using JWT token (not anon key directly)

---

### Section 6: Team Communication 📢 IMPORTANT

Notify your team about the changes:

#### 6.1: Send Update to Team

- [ ] Compose message to team:
  ```
  Subject: Security Update - New Login System

  Hi team,

  We've implemented important security improvements:
  ✅ Passwords now securely hashed
  ✅ Login uses encrypted HTTPS
  ✅ Your sessions are more secure
  ✅ Data is protected at database level

  What changes for you:
  - Your login works the same way
  - You stay logged in longer
  - Password: minimum 8 characters

  If you have login issues:
  1. Make sure email is correct
  2. Try resetting password via Supabase
  3. Contact [admin] for help

  This upgrade protects all your data.
  ```

- [ ] Send to: [team email list]

#### 6.2: Monitor First 24 Hours

- [ ] Check Supabase logs for errors
- [ ] Check Vercel logs for errors
- [ ] Monitor for failed login attempts
- [ ] Be available for user support questions
- [ ] Keep backup of old system (just in case)

---

### Section 7: Rollback Plan 🔄 (Backup Only)

If critical issues occur:

- [ ] Have database backup ready
- [ ] Have code git history available
- [ ] Revert to previous version: `git revert <commit>`
- [ ] Redeploy: Push to GitHub
- [ ] Notify team of rollback

**Note**: Rollback should not be needed if all steps completed correctly

---

## Final Verification Checklist

### Code Changes ✅
- [x] AuthContext uses Supabase Auth
- [x] LoginPage validates input
- [x] CSV export sanitized
- [x] Security headers added
- [x] Loading state handled

### Database Configuration ⏳ (Your responsibility)
- [ ] Anon key rotated
- [ ] All users migrated (with matching UUIDs)
- [ ] RLS enabled on all 16 tables
- [ ] Password column deleted
- [ ] Verified with SQL queries

### Testing ⏳ (Your responsibility)
- [ ] Local login works
- [ ] Production login works
- [ ] All users can log in
- [ ] Session persistence works
- [ ] All features work
- [ ] No console errors
- [ ] Security headers present

### Deployment ⏳ (Your responsibility)
- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful
- [ ] Environment variables correct
- [ ] Team notified

---

## Success Criteria

✅ Deployment is successful when:

1. **Security**: RLS enabled on database, passwords hashed
2. **Authentication**: Users can log in with new auth system
3. **Functionality**: All app features work (no broken pages)
4. **Testing**: No errors in console, all users can log in
5. **Performance**: App loads quickly, no delays
6. **Rollback**: Can rollback to previous version if needed

---

## Timeline

| Phase | Task | Estimated Time | Blocker |
|-------|------|-----------------|---------|
| Setup | Rotate anon key | 5 min | No |
| Setup | Migrate users | 20 min | No |
| Setup | Enable RLS | 5 min | No |
| Setup | Delete password column | 2 min | After migration |
| Test | Local testing | 15 min | No |
| Deploy | Push to GitHub | 2 min | After local test |
| Deploy | Vercel deployment | 5 min | After GitHub push |
| Test | Production testing | 10 min | After deployment |
| Verify | Team testing | 15 min | After production |

**Total Time**: 1-2 hours

---

## Sign-Off

By checking these boxes, you confirm the deployment is ready and safe:

- [ ] All code changes reviewed
- [ ] All database changes applied and tested
- [ ] Local testing passed
- [ ] Production testing passed
- [ ] Team notified
- [ ] Ready for production use

**Deployment Date**: ________________  
**Deployed By**: ________________  
**Verified By**: ________________

---

## Ongoing Maintenance

### Daily
- [ ] Monitor Supabase logs for errors
- [ ] Check for failed login attempts

### Weekly
- [ ] Review authentication logs
- [ ] Check for unusual activity

### Monthly
- [ ] Review RLS policies
- [ ] Verify all tables have RLS
- [ ] Check user access patterns
- [ ] Update documentation if needed

### Quarterly
- [ ] Security review
- [ ] Password strength verification
- [ ] Access control audit

---

## Support & Escalation

### If Login Fails
1. Check Supabase Auth users table
2. Verify UUID matches database
3. Check user credentials correct
4. Reset password in Supabase

### If RLS Blocks Access
1. Check user's role in database
2. Verify RLS policy syntax
3. Check auth.uid() in session
4. Review policy logic

### If Data Missing
1. Verify RLS policies applied
2. Check user has read permission
3. Verify auth.uid() is set
4. Review policy filtering logic

---

## Resources

- Supabase Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- Vercel Deployment: https://vercel.com/docs/deployments/overview
- Security Best Practices: https://cheatsheetseries.owasp.org

---

## Approval

- [ ] Security team approved
- [ ] Manager approved
- [ ] Ready to deploy to production

---

**Status**: 🟡 READY TO DEPLOY (after manual steps)  
**Last Updated**: 2026-04-28  
**Next Review**: After deployment
