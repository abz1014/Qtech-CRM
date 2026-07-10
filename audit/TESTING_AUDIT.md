# TESTING_AUDIT.md — Q-Tech CRM (Read-Only Audit)

## Current state

- **Unit:** vitest configured (jsdom, `src/test/`) — effectively no meaningful coverage of business logic.
- **E2E:** Playwright installed with a pass-through Lovable config (`playwright.config.ts` — all overrides commented out) and `playwright-fixture.ts`, but **no `test:e2e` script** and no test specs found. Dead tooling.
- **CI:** none. Nothing runs on push; Vercel builds are the only gate (type errors surface there, tests never run).
- **Manual verification:** the de facto process (this session's dashboard regressions demonstrate the cost: React #310 shipped to prod twice).

## Coverage: ~0% of critical logic

## Highest-regression-risk untested areas (test these first)

1. **Date/quarter math** — getPipelineMetrics ranges, quarter start/end, getOrderDate fallback, UTC-vs-PKT "today" (pure functions once extracted → trivial to unit test; would have caught the 11-day window, 8-day week, month-end drop-off)
2. **Target Achieved attribution** — orders per quarter, dateless orders, converted-status filters
3. **Follow-up automation** — trigger rules, dedup (currently none), recurrence parsing, due-date math
4. **Payment status math** — recordPayment/recordPayablePayment totals, float-equality Paid check, invoice numbering
5. **Realtime reducers** — INSERT dedup (currently duplicates), UPDATE/DELETE id-matching
6. **Cascade deletes** — deleteClient/deleteRFQ/deleteOrder state consistency
7. **RLS-behavior contract** — an integration smoke: each role attempts each op, asserting expected allow/deny (would immediately reveal which RLS regime is live in prod)

## Recommended minimal test strategy (aligned with refactor plan)

- **Step 1:** extract date/metric helpers into `src/lib/metrics.ts` + `src/lib/dates.ts` pure functions → vitest unit tests (fast, no mocks).
- **Step 2:** reducer-style tests for realtime handlers (feed synthetic payloads, assert no dupes).
- **Step 3:** one Playwright happy-path: login → create RFQ → float → quote → convert → verify dashboard counts. Wire `test:e2e` script + GitHub Action.
- **Step 4:** RLS contract script (runs against a staging Supabase project).

**Testing score: 1/10.**
