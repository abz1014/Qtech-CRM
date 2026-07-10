# PERFORMANCE_AUDIT.md — Q-Tech CRM (Read-Only Audit)

## Critical

1. **Unmemoized CRMContext provider value** (`CRMContext.tsx:1790-1815`): fresh ~110-member object every render + monolithic context → **every consumer re-renders on any state change anywhere**. The ~80 useCallback wrappers are wasted because the value object itself isn't memoized. Fix: `useMemo` the value object (cheap, low-risk); then split into domain contexts (larger change).

## High

2. **Whole-database load on login** (`CRMContext.tsx:189-205`): 15 `select('*')` queries, no pagination, for every user regardless of role — includes all financial data. Grows linearly with business data forever. Fix path: per-page/react-query fetching (React Query is already installed and mounted, unused).
3. **Realtime channel leak** (`CRMContext.tsx:440-442`): cleanup returned from the inner async `load()`, not the useEffect — unsubscribe never runs; channels accumulate on unmount/HMR.
4. **No code splitting config** (`vite.config.ts`): 560KB index chunk; recharts + jsPDF + all pages in one bundle. Add `manualChunks` for vendor libs.
5. **LoginPage 81KB chunk**: zod + react-hook-form + resolvers imported only here, for a 2-field form (`LoginPage.tsx:4-6`).
6. **`backdropFilter: blur(12px)` reintroduced** on the sticky header (`AppLayout.tsx:54`) — directly contradicts the codebase's own note at `index.css:154` ("no backdrop-filter — forces full repaint"). Every scroll frame repaints through the blur. This was the exact cause of the previous ~30fps site-wide jank.

## Medium

7. **O(n×m) `.some()` inside `.filter()`** over rfqs × supplierQuotes/Inquiries (`DashboardPage.tsx:83,98-100`, `DailyRFQReportPage.tsx:55-59,87-89`, `CRMContext.tsx:766-779`). Memoized, but the memos invalidate on every context change (see #1) so they recompute constantly. Build `Set`s of rfq_ids once → O(n+m).
8. **Duplicate rows from realtime echo** (see BUSINESS_LOGIC_AUDIT §1) — also a perf issue: arrays grow with phantom entries until reload.
9. **Sequential awaited loops** in deleteClient (`CRMContext.tsx:870-875`) — N+1 network round-trips; use `.in()` batches.

## Low

10. `useURLState.ts` sessionStorage hook — cheap; naming and 2-page-only adoption are consistency issues, not perf.
11. Dead components (6+) and the unrouted Bookkeeping module still compile into the graph; tree-shaking mostly handles it, but they're loaded via CRMContext data regardless.

## Caching / Memory

- Profile cache (localStorage, 12h) is the only cache. No react-query caching (unused), no service worker. Memory: leaked realtime channels (#3) are the main leak risk.

## Recommended order (no behavior change)

1. Memoize provider value (1 line-ish, big win)
2. Fix channel-leak cleanup return
3. Remove header backdrop-filter (match the documented rule)
4. Id-dedup in realtime INSERT handlers
5. Set-based lookups for pipeline metrics
6. manualChunks vendor split; drop zod/RHF from Login or adopt app-wide

**Performance score: 4/10** (works at current data size; every axis degrades linearly with growth).
