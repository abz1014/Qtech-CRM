# FEATURE_INVENTORY.md — Q-Tech CRM (Read-Only Audit)

> Every routed page, its purpose, implementation, tables, and known issues. Verified by reading `src/App.tsx` routes and each page file.

## Routed Features

| Feature | Route | File | Purpose | Tables used | Status / issues |
|---|---|---|---|---|---|
| Login | (rendered in place when unauthenticated) | `src/pages/LoginPage.tsx` | Email/password via Supabase Auth; zod validation (email format, 8-128 char password) | `users` (profile fetch) | Working. 81KB lazy chunk — pulls in heavy deps; see FRONTEND_ANALYSIS |
| Dashboard | `/dashboard` | `src/pages/DashboardPage.tsx` (35KB) | KPI dashboard: last-10-days pipeline, monthly/quarterly pipeline, previous-quarter selector, quarter targets (admin-editable), overall KPIs, top clients | rfqs, orders, supplier_inquiries, supplier_quotes, follow_up_actions, clients, prospects, **quarterly_targets (direct Supabase access, bypasses CRMContext)** | Recently rebuilt (hooks-before-returns fix). `quarterly_targets` has no realtime — other admins' target edits don't propagate until reload |
| Clients | `/clients`, `/clients/:id` | `ClientsPage.tsx`, `ClientDetailPage.tsx` | Client directory + detail | clients | Working |
| Prospects | `/prospects`, `/prospects/:id` | `ProspectsPage.tsx`, `ProspectDetailPage.tsx` | Prospect pipeline (hot/warm/cold); convertProspect promotes to client | prospects, clients | Working |
| RFQs | `/rfqs`, `/rfqs/:id` | `RFQsPage.tsx` (42KB), `RFQDetailPage.tsx` (**70KB**) | Core workflow: RFQ lifecycle, line items, supplier inquiries/quotes, value scoring, convert-to-order, loss tracking, deadline tracking | rfqs, rfq_line_items, supplier_inquiries, supplier_quotes, orders, vendors, clients | Working. RFQDetailPage is the largest file in the codebase — refactor candidate |
| Daily RFQ Report | `/daily-rfq-report` | `DailyRFQReportPage.tsx` | Date-range RFQ metrics (received/floated/responded), sorted newest-first | rfqs, supplier_inquiries, supplier_quotes | Working |
| Actions | `/actions` | `ActionsPage.tsx` (35KB) | Follow-up center: overdue/today/upcoming tabs, search, snooze, complete-with-outcome, sequences, pattern insights; sidebar overdue badge | follow_up_actions, rfqs, orders | Working; badge recently aligned to overdue-only |
| Orders | `/orders`, `/orders/:id` | `OrdersPage.tsx`, `OrderDetailPage.tsx` | Order lifecycle state machine, PO numbers/dates, engineer assignment, costs/profitability | orders, order_engineers, clients, vendors | Working. Legacy orders have NULL customer_po_date AND confirmed_date (8 rows in prod) — affects search & finance grouping |
| Vendors | `/vendors`, `/vendors/:id` | `VendorsPage.tsx`, `VendorDetailPage.tsx` | Supplier directory | vendors | Working |
| Team | `/team` | `TeamPage.tsx` | User management (admin) | users, Edge Function `create-user` | Client-side admin guard only; Edge Function verifies admin server-side (good) |
| My Jobs | `/my-jobs` | `MyJobsPage.tsx` | Engineer's assigned orders + commissioning updates | order_engineers, orders | Working |
| Finance | `/finance` | `FinancePage.tsx` (22KB) | Order-based financial reporting, date presets, custom range, CSV export | orders, rfqs | Working; overlaps conceptually with orphaned Bookkeeping module |
| 404 | `*` | `NotFound.tsx` | Catch-all | — | Working |

## Orphaned / Dead Features (no route, no importers — verified by grep)

| Item | File | Notes |
|---|---|---|
| **Bookkeeping module (entire)** | `src/pages/BookkeepingPage.tsx` + 17 components in `src/components/bookkeeping/` | 10-tab finance suite (Dashboard, Invoices, Expenses, AR Aging, Payables, AP Aging, Cashflow, Budget vs Actual, Reports, Audit Log). **Not routed, not in sidebar, imported nowhere.** Yet its data (invoices, expenses, payables, payment_records) is loaded + realtime-subscribed for every user in CRMContext — wasted bandwidth and financial data exposure to non-admin clients (RLS permitting) |
| Budget vs Actual | `BudgetVsActualTab.tsx:46-47` | Uses hardcoded `sampleBudgets` ("in real app, these would come from database") |
| Budget form | `BudgetForm.tsx:47-49` | Does not persist — `console.log('Budget would be created', …)` |
| Audit Log | `AuditLogTab.tsx:28-29` | Synthesized in memory from invoices/expenses/payments — **no audit_log table exists** |
| Index stub | `src/pages/Index.tsx` | 4-line `<Navigate to="/" />`, unused |
| RFQ timeline viz | `src/components/RFQTimelineVisualization.tsx` (6KB) | Exported, imported nowhere |
| NavLink wrapper | `src/components/NavLink.tsx` | Imported nowhere (sidebar uses buttons + navigate()) |
| shadcn pagination | `src/components/ui/pagination.tsx` | Unused; custom `src/components/Pagination.tsx` is what 8 pages use |
| Duplicate use-toast | `src/hooks/use-toast.ts` + `src/components/ui/use-toast.ts` | Two copies |

## Repo-Root Debris (18 markdown + SQL files)

Phase docs (`PHASE2_*`, `PHASE3_COMPLETE.md`, `PROJECT_COMPLETE.md`, `BOOKKEEPING_*`, `TIMELINE_STATUS.md`, `DEPLOYMENT_CHECKLIST.md`), security docs (`SECURITY_*`, `RLS_POLICIES_EXPLAINED.md`, `PASSWORD_CLEANUP_CHECKLIST.md` — evidence of a past credential-hygiene incident), seed/cleanup SQL (`SEED_CRM_DATA.sql`, `CLEANUP_MOCK_DATA.sql`, `SEED_MOCK_DATA.md`), and `.claude/plans/*` are committed. Recommendation: move to `/docs` or delete; keep SQL under `supabase/migrations/` only.

## Process Finding

Git history is being recreated (everything staged as `A`, no prior commits in this working tree). Deploys happen from a second copy (`Qtech-CRM-fresh`) via manual file copy. Consolidation recommended (see MASTER_REFACTOR_PLAN.md).
