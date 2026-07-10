# SYSTEM_ARCHITECTURE.md — Q-Tech CRM (Read-Only Audit)

> Audit date: 2026-07-10 · Scope: full repo at `q-tech-crm-main` · No code was modified.
> Anything not verifiable from the repo (live Supabase state, executed SQL, Vercel env) is explicitly flagged UNVERIFIABLE.

## 1. Frontend Architecture

- **Stack:** Vite 5 + React 18 + TypeScript (SWC plugin). Scaffolded from Lovable (`package.json` name `vite_react_shadcn_ts`; `lovable-tagger` dev dependency, dev-mode-only `componentTagger()` at `vite.config.ts:15`).
- **UI:** shadcn/ui (full Radix suite in `src/components/ui/`), Tailwind 3, lucide-react icons, recharts for charts. Both sonner and Radix toast Toasters mounted (`src/App.tsx:70-71`) — two toast systems coexist.
- **Dev server:** port 8080; `@` → `./src` alias; aggressive `resolve.dedupe` of react/react-query (`vite.config.ts:16-21`).
- **Tests:** vitest (jsdom, `src/test/`) + Playwright via `lovable-agent-playwright-config` (`playwright.config.ts` is a pass-through stub, all overrides commented out).
- **Bootstrap:** `src/main.tsx` is a minimal 5-line entry.

## 2. Routing (`src/App.tsx`)

- react-router-dom v6, `BrowserRouter`. All 18 pages **lazy-loaded** (lines 17-34; comment notes this fixed a TDZ crash from bundle ordering).
- Routes (lines 77-96): `/dashboard`, `/clients(/:id)`, `/prospects(/:id)`, `/rfqs(/:id)`, `/daily-rfq-report`, `/actions`, `/orders(/:id)`, `/vendors(/:id)`, `/team`, `/finance`, `/my-jobs`, `*` → NotFound.
- **Route guard:** `ProtectedRoutes` (lines 48-64) — unauthenticated users get `LoginPage` rendered in place (no redirect). Authenticated users get `AppLayout` (sidebar + `<Outlet/>`).
- **GAP: no per-route role guards in the router.** Role gating is done by hiding sidebar links and by ad-hoc checks inside some pages. A sales user typing `/team` directly reaches the page component unless that page self-guards.

## 3. State Management

- **Two global contexts; React Query effectively unused** (QueryClientProvider mounted at `App.tsx:68` but no queries configured — all state lives in contexts).
- **`src/contexts/CRMContext.tsx` (~1,636 lines) — the monolith:**
  - On mount: `Promise.all` of **15 full-table `select('*')` queries** (lines 189-205): users, clients, prospects, vendors, orders, order_engineers, rfqs, supplier_inquiries, supplier_quotes, rfq_line_items, follow_up_actions (pending only), invoices, expenses, payment_records, payables. No pagination. Loaded for **every logged-in user regardless of role** (financial data included).
  - One Supabase realtime channel `crm-changes` (line 224) with **14 `postgres_changes` listeners** (lines 229-424) patching local state on INSERT/UPDATE/DELETE.
  - ~80 CRUD/analytics functions exposed via context (interface at lines 23-147). Several return `Promise<any>` — weakly typed.
  - Order-status state machine `allowedTransitions` (lines 15-21): po_received → procurement → in_transit → delivered → payment_received.

## 4. Authentication (`src/contexts/AuthContext.tsx`)

- Supabase Auth email/password (`signInWithPassword`, line 162). Profile row fetched from custom `users` table keyed by auth uid (line 63).
- Profile **cached in localStorage** (`qtcrm_profile`, 12h TTL, lines 21-50) for instant reload; refreshed in background. DB fetch has a 6s timeout race (lines 56-83) + 8s global safety timeout (line 146) to survive Supabase cold starts.
- Roles: `admin` / `sales` / `engineer` → `isAdmin/isSales/isEngineer` booleans (lines 219-221).
- **Quirks:**
  - If the profile fetch times out after login, the user is admitted with no profile (lines 194-197).
  - Role comes from a client-cached localStorage blob — locally editable. Real protection depends entirely on RLS (see SECURITY_AUDIT.md / DATABASE_ANALYSIS.md — RLS state is UNVERIFIABLE from the repo).

## 5. Authorization

- Client-side only in the SPA: `isAdmin`/`isSales` checks per page/component. Server-side enforcement depends on Supabase RLS; the repo contains **two mutually exclusive RLS regimes** (open `allow_all` in `supabase/schema.sql` vs role-based in `supabase/migrations/enable_rls_security_policies.sql`). Which is live is UNVERIFIABLE. See DATABASE_ANALYSIS.md §4.

## 6. Services / Background Jobs / Scheduled Tasks

- None. No edge functions, no `.rpc()` calls, no cron. All business logic is client-side JavaScript.
- "Automation" (follow-up creation, recurrence) runs in the browser at interaction time, not on a schedule.

## 7. File Storage

- None found. No Supabase Storage usage.

## 8. Build & Deployment

- **Vercel SPA:** `vercel.json` catch-all rewrite to `index.html` + security headers (HSTS, CSP with `connect-src` limited to `*.supabase.co`/`wss://*.supabase.co`, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy).
- **No CI config.** Deploys triggered by push to `main` on GitHub (`abz1014/Qtech-CRM`), which is a *separate copy* of this working directory (`Qtech-CRM-fresh`) — changes are hand-copied between the two. High drift risk.
- **Mixed package managers:** `bun.lock`, `bun.lockb`, and `package-lock.json` all committed.

## 9. Environment Configuration

- Supabase client built from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.ts`).
- **`.env` with the live URL + publishable key exists in the working tree.** Anon/publishable key exposure is normal for Supabase SPAs, but verify `.gitignore` actually excludes it from the repo and that no service-role key ever lands there.

## 10. External Integrations

- Supabase only. No email, payments, or analytics. Currency hardcoded to PKR (`formatPKR` in `src/lib/format`; `Intl en-PK`).

## 11. Deployment Topology Risk (process finding)

- Development happens in `q-tech-crm-main`; deploys happen from `Qtech-CRM-fresh` via manual file copy + commit. There is no single source of truth. Recommendation (roadmap item): consolidate to one repo, or make `q-tech-crm-main` the git remote's working tree.

## 12. Architecture Scores (1-10)

| Area | Score | Rationale |
|---|---|---|
| Architecture | 5 | Sound SPA basics (lazy routes, contexts, realtime) undermined by a 1,636-line god-context, client-side-only business logic, and dual-repo deploy flow |
| Build/Deploy | 4 | Works, but no CI, mixed lockfiles, manual copy between two repos |
| Auth | 5 | Supabase Auth is solid; localStorage role cache and timeout-admit weaken it; RLS posture unverifiable |
