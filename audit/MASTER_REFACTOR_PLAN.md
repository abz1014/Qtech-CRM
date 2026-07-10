# MASTER_REFACTOR_PLAN.md — Q-Tech CRM
**Prioritized, low-risk implementation roadmap · Nothing here has been implemented**

Legend — Effort: S (<1h) / M (half-day) / L (1-3 days) / XL (1 wk+) · Regression risk: 🟢 low / 🟡 medium / 🔴 high
Recommended order = the numbering below. Each item lists required testing.

---

## Priority 0 — Verify before touching code (manual, Supabase dashboard)

| # | Task | Why | Effort |
|---|---|---|---|
| 0.1 | Check if `users.password` column still exists; if yes, `ALTER TABLE users DROP COLUMN password;` | Conditional-critical plaintext credential exposure | S |
| 0.2 | Determine which RLS regime is live (run `select * from pg_policies` in SQL editor; save output into repo) | Everything about delete/update behavior depends on it | S |
| 0.3 | Export current production DDL (`supabase db pull` or dashboard) into `supabase/migrations/` as the baseline migration, incl. quarterly_targets | Ends schema drift; prerequisite for every DB change below | M |
| 0.4 | Backfill the 8 orders with NULL customer_po_date/confirmed_date (one UPDATE with real PO dates from records) | Prerequisite for correct Target Achieved (2.2) | S |

## Priority 1 — Critical bugs (data users see is wrong today)

| # | Task | Files | Effort | Risk | Testing |
|---|---|---|---|---|---|
| 1.1 | **Id-dedup in realtime INSERT handlers** — `if (prev.some(x => x.id === payload.new.id)) return prev;` in all 14 listeners | CRMContext.tsx:229-424 | S | 🟢 | Create an RFQ/order/invoice; assert it appears once without reload |
| 1.2 | **Fix realtime channel leak** — return the cleanup from the useEffect, not from inner `load()` | CRMContext.tsx:440-442 | S | 🟢 | HMR/unmount; check supabase.getChannels() count |
| 1.3 | **`businessToday()` helper (Asia/Karachi)** in `src/lib/dates.ts`; replace every `new Date().toISOString().split('T')[0]` (all locations listed in BUSINESS_LOGIC_AUDIT §0); fix the two local→UTC month-boundary conversions (DashboardTab.tsx:25, FinancePage.tsx:19) | ~15 files | M | 🟡 | Unit tests for boundary times (23:30 PKT, 01:00 PKT); month-end inclusion |
| 1.4 | **Surface write errors** — wrap the ~25 unchecked writes to check `{ error }`, show toast, and NOT mutate local state on failure (root cause of "deleted rows come back") | CRMContext.tsx (list in DATABASE_ANALYSIS §8) | L | 🟡 | Temporarily deny an op via RLS; verify user sees an error and state stays consistent |
| 1.5 | **Dashboard `today` staleness** — recompute per render or on an interval instead of `useMemo([], …)` once | DashboardPage.tsx:20-24 | S | 🟢 | Leave tab across midnight (or mock clock) |

## Priority 2 — Security

| # | Task | Files | Effort | Risk | Testing |
|---|---|---|---|---|---|
| 2.1 | Upgrade react-router-dom to patched release; `npm audit fix` the rest | package.json | S-M | 🟡 | Full nav smoke test |
| 2.2 | CSV formula-injection guard (prefix `=`,`+`,`-`,`@`,tab,CR cells with `'`); also escape embedded quotes in DailyRFQReportPage:145 | src/lib/csvExport.ts, DailyRFQReportPage.tsx | S | 🟢 | Export cells starting with `=HYPERLINK`; open in Excel |
| 2.3 | Remove `'unsafe-inline'` from script-src; add Permissions-Policy | vercel.json | S | 🟡 | Deploy preview; check console for CSP violations |
| 2.4 | Add missing DELETE (and rfq_line_items UPDATE) policies matching actual app operations — as a tracked migration | supabase/migrations/ | M | 🟡 | RLS contract script (TESTING_AUDIT step 4) |
| 2.5 | Unstage/ignore `.claude/settings.local.json` + `supabase/.temp/`; drop bun lockfiles (keep package-lock.json) | repo root | S | 🟢 | — |
| 2.6 | Shorten profile cache TTL (12h → ~1h) and re-validate role on window focus | AuthContext.tsx:21-50 | S | 🟢 | Demote a test user; observe UI |

## Priority 3 — Data integrity

| # | Task | Files | Effort | Risk | Testing |
|---|---|---|---|---|---|
| 3.1 | **Canonical order date**: after 0.4 backfill, make Target Achieved / Finance use `customer_po_date` only (fallback `confirmed_date`), delete the delivery/RFQ-date fallbacks; make `customer_po_date` required on order creation forms | DashboardPage.tsx:130-159, FinancePage.tsx:86-92, OrdersPage form | M | 🟡 | Unit tests: quarter attribution fixed-point (order never migrates); Σ(quarters) = total |
| 3.2 | Align pipeline **poReceived** to conversion date (store `converted_at` on RFQ at conversion; count by it) and **quotedToClient** to `quote_sent_date` | CRMContext convertRFQToOrder, DashboardPage:84-85 | M | 🟡 | Historical quarters stop mutating; June PO count matches Orders page |
| 3.3 | Add FKs as migration: orders.rfq_id, rfqs.converted_order_id (ON DELETE SET NULL), invoices/expenses.rfq_id; composite index follow_up_actions(entity_type,entity_id) | migration | M | 🟡 | Existing dangles must be cleaned first (SQL audit query) |
| 3.4 | Move invoice numbering to a Postgres sequence + UNIQUE(invoice_number); payment totals via trigger or `.rpc()` | migration + CRMContext:904-1016 | L | 🟡 | Two concurrent creates → distinct numbers |
| 3.5 | Atomic cascades: deleteClient/deleteOrder as Postgres functions called via `.rpc()`; remove side-effects-inside-setState anti-pattern (deleteOrder) | migration + CRMContext:833-888 | L | 🟡 | Partial-failure simulation |
| 3.6 | Follow-up dedup: before autoFollowUp insert, skip if same (entity_id, action_type) pending exists; use `recurrence_days` column instead of `__recur:N__`; stop overwriting description on complete (add `outcome` column) | CRMContext:463-495, 1560-1613 | M | 🟡 | Toggle RFQ status twice → one action |
| 3.7 | Commit quarterly_targets DDL + add DELETE policy decision; subscribe it to realtime or refetch on focus | migration + DashboardPage | S | 🟢 | Two-browser admin edit test |

## Priority 4 — Performance

| # | Task | Files | Effort | Risk |
|---|---|---|---|---|
| 4.1 | `useMemo` the CRMContext provider value | CRMContext.tsx:1790 | S | 🟢 |
| 4.2 | Remove header `backdropFilter: blur(12px)` (use opaque gradient per index.css rule) | AppLayout.tsx:54 | S | 🟢 |
| 4.3 | Set-based rfq_id lookups in pipeline metrics (O(n+m)) | DashboardPage, DailyRFQReportPage, CRMContext:766-779 | S | 🟢 |
| 4.4 | Vite `manualChunks` (recharts, jspdf, radix); drop zod/RHF from Login or adopt app-wide | vite.config.ts, LoginPage | M | 🟡 |
| 4.5 | (Later, with 5.1) role-scoped loading: don't load invoices/expenses/payables for non-admin sessions | CRMContext | M | 🟡 |

## Priority 5 — Maintainability

| # | Task | Effort | Risk |
|---|---|---|---|
| 5.1 | Split CRMContext into domain contexts (core CRM / bookkeeping / follow-ups) or migrate reads to React Query (already installed) | XL | 🔴 — do LAST, after tests exist |
| 5.2 | Extract `src/lib/status.ts` (all color/label maps), `src/lib/dates.ts`, `src/lib/metrics.ts` (pure, unit-tested) | M | 🟢 |
| 5.3 | Delete dead code: BookkeepingPage decision (route it or remove module), Index.tsx, RFQTimelineVisualization, FollowUpActionsDashboard, OrderDetailView, ProfitabilityDashboard, SupplierComparisonTable, NavLink, ui/pagination, duplicate use-toast | M | 🟢 |
| 5.4 | Move 18 root .md files to /docs; keep SQL only under supabase/migrations | S | 🟢 |
| 5.5 | **Consolidate the two repos** (q-tech-crm-main vs Qtech-CRM-fresh) into one git working tree; add CI (typecheck + vitest on push) | M | 🟢 process-wise |
| 5.6 | Type the gaps: FollowUpAction interface, add created_at to entity types, remove `(x as any)` casts | M | 🟢 |
| 5.7 | Split RFQDetailPage (70KB) into subcomponents | L | 🟡 |

## Priority 6 — UI/UX

| # | Task | Effort | Risk |
|---|---|---|---|
| 6.1 | Replace 27 alert()/5 confirm() with Sonner toasts + one shared ConfirmDialog; remove the unused toast system | M | 🟢 |
| 6.2 | Shared `<Modal>` wrapper on Radix Dialog (focus trap, Escape, scroll-lock); migrate the 46 hand-rolled overlays incrementally | L | 🟡 |
| 6.3 | Standardize dates on formatDate() (single locale) app-wide | S | 🟢 |
| 6.4 | Skeletons for detail pages, Finance, Actions, Team | M | 🟢 |
| 6.5 | Label fixes: "Last 10 Days" window (make it truly 10), "Last 7 Days" (8-day bug), "Payments Pending" wording, AR bucket labels | S | 🟢 |

## Priority 7 — Analytics improvements

| # | Task | Effort | Risk |
|---|---|---|---|
| 7.1 | Fix `outstanding_ap` (sum payables) — one line | S | 🟢 |
| 7.2 | Rebuild cashflow on payment_records (or rename the tab honestly) | M | 🟡 |
| 7.3 | Wire Budget vs Actual to the budgets table (persist BudgetForm) or remove the tab | M | 🟢 |
| 7.4 | Recalibrate quote value score (percentile-based within the RFQ's quotes; rebalance weights) or hide the badge | M | 🟡 |
| 7.5 | Fix Daily Report bucket partitioning (floated-awaiting excludes responded; dropdown ≡ sections; true notFloated complement everywhere) | M | 🟢 |
| 7.6 | Fix getPatternInsights (load completed actions for the stats window) | M | 🟢 |

## Priority 8 — Future enhancements

- Salesperson conversion-rate & response-time KPIs (data already exists)
- Loss-reason trend report; QoQ comparison view
- Real append-only audit_log table; AP payment history (payable_payments)
- E2E happy-path in CI; RLS contract tests against staging
- Server-authoritative time & sequences via Postgres functions

---

## Sequencing rationale

1. **P0 verifications** cost minutes and change what everything else means.
2. **P1** items are small, surgical, and fix data users see *today* — each independently shippable.
3. **P2/P3** harden the boundary and make the numbers stable before any big refactor.
4. **Tests (TESTING_AUDIT strategy) land alongside P3** — the pure-function extraction (5.2) is deliberately early because it enables them.
5. **The context split (5.1) goes last** — highest regression risk; only attempt with tests green.
