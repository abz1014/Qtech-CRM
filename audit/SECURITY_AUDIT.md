# SECURITY_AUDIT.md — Q-Tech CRM (Read-Only Audit)

> OWASP-oriented review. Live Supabase state (which SQL ran, key rotation) is UNVERIFIABLE from the repo; those items are flagged for manual dashboard verification.

## 1. Authentication & Sessions

- ✅ Real Supabase Auth: `signInWithPassword` (`AuthContext.tsx:162`), `signOut` (:208), JWT sessions with auto-refresh via supabase-js. LoginPage adds zod validation (email format, 8-128 char password) and posts via handler, not URL.
- ⚠️ **Medium — 12h localStorage profile/role cache** (`AuthContext.tsx:21-50`): a demoted/revoked user keeps their old role in the UI until refresh succeeds; cache is tamperable (cosmetic only *if* RLS is correct).
- ⚠️ **Medium — Login proceeds with no profile row** (`AuthContext.tsx:194-197`) when the DB fetch times out.

## 2. Password Handling — CONDITIONAL CRITICAL

- `SECURITY_FIX_START_HERE.md` documents a prior incident: credentials in query string + **plaintext `users.password` column**. Code has been migrated to Supabase Auth, and the anon key appears rotated (new-format `sb_publishable_` key in `.env`).
- ❌ **The `ALTER TABLE users DROP COLUMN password;` step (SECURITY_FIX_START_HERE.md:112) has no migration evidence.** If never run manually, plaintext passwords are still in the table. **ACTION: verify in Supabase dashboard immediately.**

## 3. Secrets

- ✅ No hardcoded keys in `src/`; client uses `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.ts:3-4`). `.env` gitignored and not staged (verified via `git ls-files`). No service_role key in client code; only server-side in Edge Function `supabase/functions/create-user/index.ts:44-47` via `Deno.env` (correct pattern).
- ⚠️ Low — anon key embedded in **`.claude/settings.local.json:28-30`** (staged for commit) and project URL in `DEPLOYMENT_CHECKLIST.md:140` / `SECURITY_SETUP.md:45,150`; `supabase/.temp/pooler-url` (committed) leaks the pooler DSN (no password). Unstage `.claude/settings.local.json` and `supabase/.temp/` before first commit — repo currently has zero commits, so now is the moment.

## 4. Headers / CSP (`vercel.json`)

- ✅ Solid baseline: HSTS+preload, X-Content-Type-Options, X-Frame-Options DENY + frame-ancestors 'none', Referrer-Policy, connect-src scoped to *.supabase.co.
- ⚠️ **Medium — `script-src 'unsafe-inline'`** (vercel.json:18) largely defeats CSP XSS protection; Vite prod builds don't need it.
- ⚠️ Low — no `Permissions-Policy` header; `img-src https:` allows any origin; `X-XSS-Protection` obsolete (harmless).

## 5. Injection / XSS / CSRF

- ✅ XSS: only `dangerouslySetInnerHTML` is shadcn's chart.tsx:70 (static theme CSS — safe). `email_draft` renders as escaped JSX text (`RFQDetailPage.tsx:827`). No file uploads.
- ❌ **High — CSV formula injection:** `src/lib/csvExport.ts:1-11` escapes quotes but not `=`, `+`, `-`, `@`, tab/CR prefixes. User-supplied fields (client names, RFQ descriptions) exported from ~10 pages can execute as formulas (`=HYPERLINK`, DDE) when opened in Excel. Fix: prefix risky cells with `'`.
- ✅ SQL injection: not applicable client-side (PostgREST parameterized); no string-built SQL.
- CSRF: JWT-in-header model (supabase-js) — not cookie-based; low risk.

## 6. Authorization (RLS)

- Client-side `isAdmin/isSales` checks are cosmetic — with a public anon key, anyone can hit PostgREST directly; **RLS is the only real boundary**.
- Two conflicting RLS regimes in the repo (open `allow_all` vs role-based) — which is live is UNVERIFIABLE. See DATABASE_ANALYSIS §4.
- `quarterly_targets`: session-verified to have select(all)/insert(admin)/update(admin) policies (created manually); **no DELETE policy; DDL not in repo**.
- **Medium — Missing DELETE policies** in the role-based script for orders, invoices, expenses, payables, supplier_inquiries, supplier_quotes, rfq_line_items, follow_up_actions — yet the app calls delete on all of them, mostly without error checks → silent failures (matches the reported "deleted rows come back" bug).
- ✅ Edge Function `create-user` verifies caller is admin server-side (index.ts:49-60+). CORS `*` acceptable (auth required) but could be tightened.
- ⚠️ Medium — `follow_up_actions` INSERT policy lets any user create self-assigned actions against any entity; acceptable for an internal CRM, but noted.

## 7. Rate Limiting / Abuse

- None beyond Supabase's defaults. Login has no client-side lockout (Supabase provides some server-side). Low priority for an internal tool.

## 8. Dependency Vulnerabilities (npm audit)

**20 vulnerabilities: 1 critical, 12 high, 6 moderate, 1 low — all with fixes available.**

| Sev | Package | Issue | Exposure |
|---|---|---|---|
| Critical | vitest | UI server arbitrary file read/execute | dev-only |
| High | react-router / react-router-dom / @remix-run/router | XSS via open redirect; untrusted-path redirect | **runtime, prod** |
| High | vite | dev server file disclosure | dev-only |
| High | rollup | path-traversal file write | build-time |
| High | lodash, minimatch, picomatch, glob, flatted, form-data, ws | transitive dev/build chain | dev/build |
| Moderate | esbuild, postcss, js-yaml, ajv, yaml, brace-expansion | dev chain | dev |

**Priority: upgrade react-router-dom** (only prod-runtime item). `npm audit fix` resolves most of the rest.

## 9. Ranked Summary

| Rank | Finding |
|---|---|
| Critical (verify) | Plaintext `users.password` column — confirm the manual DROP ran |
| High | CSV formula injection (`csvExport.ts`) |
| High | react-router-dom advisories (runtime) |
| High | RLS regime ambiguity + missing DELETE policies vs silent client deletes |
| Medium | CSP `unsafe-inline`; no Permissions-Policy |
| Medium | 12h role cache; login-without-profile fallback |
| Medium | Three lockfiles (supply-chain determinism) |
| Low | Anon key/pooler DSN in staged tooling files; docs leak project URL |

**Security score: 5/10** — sound architecture (Supabase Auth + RLS-first design + good headers) with unverified remediation steps and several concrete gaps.
