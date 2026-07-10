# MASTER_AUDIT_REPORT.md — Q-Tech CRM
**Complete read-only audit · 2026-07-10 · No code modified**

> Note: the audit template referenced an Energy Management System; this project is the Q-Tech Industrial Engineering CRM. Phase 7 was executed as a CRM analytics audit (ANALYTICS_AUDIT.md) — every displayed metric traced to its data source.

## Executive Summary

The app is a **Vite/React/Supabase SPA with all business logic client-side** in a 1,636-line context. It works, is visually coherent, and its arithmetic is mostly right — but it has **four systemic defects** that quietly corrupt what users see, several **unverifiable security remediations**, effectively **zero tests**, and a **fragile dual-repo deploy process**.

### The Big Four (systemic, quietly wrong today)

1. **Realtime INSERT echo** — every created row appears **twice** in the UI until reload (optimistic insert + realtime broadcast, no id-dedup). Inflates badges, pipeline counts, revenue sums; double-counts inside payment recording. *(BUSINESS_LOGIC_AUDIT §1)*
2. **UTC "today" in a UTC+5 business** — every daily metric, due date, and boundary is wrong from 00:00-05:00 PKT daily; plus a permanent off-by-one that **excludes the last day of every month** from two finance views. *(§0)*
3. **Target Achieved attribution** — the mixed-date fallback chain makes orders migrate between quarters as fields get filled; 8 legacy dateless orders vanish from all quarters; poReceived counts by RFQ date while Target Achieved counts by order date — the same quarter's numbers describe different order sets. *(§2)*
4. **Silent-failure writes** — ~25 write paths ignore Supabase errors and deletes mutate local state even when the DB refused; combined with the repo's restrictive RLS script missing DELETE policies, this exactly reproduces the reported "deleted rows come back the next day" bug. *(DATABASE_ANALYSIS §8)*

### Verify-immediately security items

- **Plaintext `users.password` column** — the documented DROP was manual; no evidence it ran. Check Supabase dashboard now. *(SECURITY_AUDIT §2)*
- **Which RLS regime is live** — the repo contains both an allow-all and a role-based script; behavior differs radically. *(DATABASE_ANALYSIS §4)*
- **react-router-dom advisories** — the one production-runtime vulnerability set. *(DEPENDENCY_AUDIT)*

### Notable positives

- Rules-of-hooks: **clean** after the Dashboard fix (full sweep, zero violations elsewhere).
- Supabase Auth correctly adopted; Edge Function checks admin server-side; no service keys in client.
- `formatPKR` used consistently; sidebar badge ≡ Actions overdue count (verified); lazy-loaded routes; good security headers baseline.

## Scores (1-10)

| Area | Score | Headline reason |
|---|---|---|
| Architecture | 5 | Sound SPA basics; god-context + client-side business logic + dual-repo deploys |
| Database | 4 | Untracked DDL drift, missing FKs, TEXT dates, conflicting RLS scripts |
| Backend | 3 | No server authority: racy numbering, non-atomic cascades |
| Frontend | 5 | Clean hooks, lazy routes; unmemoized provider, dead code, alert()s |
| API | 4 | Whole-table loads, ~25 unchecked writes, duplicate access paths |
| Performance | 4 | Context re-render storm, 560KB chunk, reintroduced backdrop-filter |
| Security | 5 | Right architecture, unverified remediation, CSV injection, CSP unsafe-inline |
| Scalability | 3 | Everything loads everything; linear degradation with data growth |
| Maintainability | 4 | 70KB page files, duplicated maps, 18 root docs, two repos |
| Code Quality | 5 | Consistent style; weak typing at edges (`any`, schema drift) |
| UI | 6 | Coherent design system, dark mode, consistent currency |
| UX | 5 | Native alerts, date chaos, missing skeletons/validation |
| Business Logic | 4 | Correct arithmetic; wrong date semantics + duplication + no dedup |
| Analytics (CRM) | 4 | Real data mostly; 2 mock-backed displays, invalid cashflow, unstable attribution |
| Testing | 1 | ~Zero coverage, no CI |
| **Overall Production Readiness** | **4/10** | Usable internally today; not trustworthy for financial reporting until the Big Four + security verifications land |

## Report Index

| File | Contents |
|---|---|
| SYSTEM_ARCHITECTURE.md | Stack, routing, state, auth, deploy topology |
| FEATURE_INVENTORY.md | Every routed page + orphaned features + repo debris |
| DATABASE_ANALYSIS.md | Schema, FKs, RLS regimes, data-access layer defects |
| API_ANALYSIS.md | Per-table access matrix, Edge Function |
| FRONTEND_ANALYSIS.md | Hooks sweep, render architecture, dead code |
| BACKEND_ANALYSIS.md | Client-side-logic risks |
| SECURITY_AUDIT.md | Auth, secrets, CSP, injection, RLS gaps, npm vulns |
| PERFORMANCE_AUDIT.md | Re-renders, bundle, leaks, O(n×m) |
| UI_UX_AUDIT.md | Dialogs, dates, skeletons, a11y |
| BUSINESS_LOGIC_AUDIT.md | Every metric/workflow with verdicts (file:line) |
| ANALYTICS_AUDIT.md | Metric-to-source trace matrix (Phase 7, CRM-adapted) |
| DATABASE_UI_GAP_ANALYSIS.md | Mock-backed displays, unused data, missing analytics |
| DEPENDENCY_AUDIT.md | 20 vulns, lockfiles, dead tooling |
| TESTING_AUDIT.md | Coverage (~0), strategy |
| MASTER_REFACTOR_PLAN.md | Prioritized, regression-scored roadmap |
