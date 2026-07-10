# FRONTEND_ANALYSIS.md — Q-Tech CRM (Read-Only Audit)

## 1. Rules-of-Hooks Sweep — CLEAN ✅

A component-boundary-aware scan of every file in `src/pages/` and `src/components/` (incl. bookkeeping tabs) for hooks appearing after conditional early returns found **no violations**. Candidates that looked suspicious were verified manually:

- `RFQsPage.tsx:126` early return — hooks at 642-643 belong to the separate `LostDealsView` component (line 633). Legal.
- `ActionsPage.tsx:225` early return is in `TeamOverview`; hooks at 426+ belong to `GroupedActionList`/`ActionsPage`, each with hooks at top. Legal.
- `RFQDetailPage.tsx` / `OrderDetailPage.tsx` — all hooks at component top; later returns are inside event handlers. Legal.

The DashboardPage React #310 (fixed during this session) was the only instance.

## 2. State/Render Architecture

- **CRITICAL — Unmemoized provider value:** `CRMContext.tsx:1790-1815` passes a fresh ~110-member object literal to `<CRMContext.Provider value={{…}}>` every render. Combined with the monolithic context (11 entity arrays + all bookkeeping data + follow-ups), **every consumer re-renders on any state change anywhere**. The `useCallback` wrapping of ~80 functions is wasted because the value object itself is never memoized. Fix: `useMemo` the value; ideally split into 3-4 domain contexts.
- React Query is installed and mounted but unused — all fetching is context-based.

## 3. Components

- **Pages:** 20 (all lazy-loaded). Largest: `RFQDetailPage.tsx` 70KB (refactor candidate), `RFQsPage.tsx` 42KB, `DashboardPage.tsx` 35KB, `ActionsPage.tsx` 35KB.
- **Dead components (never imported):** `RFQTimelineVisualization.tsx`, `followup/FollowUpActionsDashboard.tsx`, `orders/OrderDetailView.tsx`, `orders/ProfitabilityDashboard.tsx`, `rfq/SupplierComparisonTable.tsx`, `NavLink.tsx`, `ui/pagination.tsx`, plus the entire unrouted Bookkeeping module.
- **Duplicated status color/label maps** (should be one `src/lib/status.ts`):
  - `rfqStatusColors`: RFQsPage.tsx:15 & ClientsPage.tsx:14 (identical)
  - `priorityColors`: RFQsPage.tsx:23 & FollowUpActionsDashboard.tsx:73
  - Order statusColors/Labels: OrdersPage.tsx:15,23; OrderDetailPage.tsx:12,20; FinancePage.tsx:140; dashboard/OrderHealthChart.tsx:5
  - Prospect statusColors: ProspectsPage.tsx:13 & ProspectDetailPage.tsx:52 (latter re-created every render)
- Duplicate `use-toast.ts` in `src/hooks/` and `src/components/ui/`. Both shadcn Toaster and Sonner mounted (`App.tsx:70-71`), **neither used** — feedback goes through `alert()`.

## 4. Data Fetching / Error Handling / Loading / Empty States

- Fetching: 15 whole-table selects on mount + realtime patching (see DATABASE_ANALYSIS §8).
- Error surfacing: 27 `alert()` calls + 5 native `confirm()` (list in UI_UX_AUDIT.md); 23 `console.error` (14 in CRMContext) swallow errors after logging — many mutation failures never reach the user.
- Loading skeletons on only 6 pages (Dashboard, RFQs, Orders, Vendors, Prospects, Clients). Detail pages, Team, Finance, Actions, and all bookkeeping tabs flash empty during load.
- Empty states exist on main lists but styling/text varies per page.

## 5. Routing & Navigation

- No per-route role guards (see SYSTEM_ARCHITECTURE §2). Back-button UX handled by a floating Back button on detail routes (`AppLayout.tsx:82-89`).
- Pagination persistence inconsistent: sessionStorage hook (`useURLState.ts` — misnamed; it's sessionStorage) used only by RFQsPage & OrdersPage; other lists use plain useState.

## 6. Forms & Validation

- Only LoginPage uses zod + react-hook-form (and pays an 81KB chunk for a 2-field form). Every other form validates ad hoc with `alert()`; no inline field errors anywhere else.

## 7. Severity Summary

| Severity | Finding |
|---|---|
| Critical | Unmemoized CRMContext provider value → app-wide re-renders |
| High | 27 alert()/5 confirm() instead of mounted toasts |
| High | 46 hand-rolled `fixed inset-0` modals; no focus trap/Escape/scroll-lock; source of past clipping bugs |
| Medium | 6+ dead components; duplicated status maps; dual toast systems |
| Medium | Skeletons on 6/20 pages; validation only on login |
| Low | useURLState misnomer; inconsistent pagination persistence |
