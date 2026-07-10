# API_ANALYSIS.md — Q-Tech CRM (Read-Only Audit)

> No custom REST API. The API surface = Supabase PostgREST (auto-generated per table), Supabase Auth, Realtime websocket, and one Edge Function. "Endpoints" below are the table-level access patterns actually used by the client.

## PostgREST usage by table (from `CRMContext.tsx` unless noted)

| Table | SELECT | INSERT | UPDATE | DELETE | Realtime | Notes |
|---|---|---|---|---|---|---|
| users | all rows (L189) | via Edge Function only | — | — | ❌ | full user list to every client |
| clients | ✅ | ✅ | ✅ | ✅ | ✅ | delete has client-side cascade |
| prospects | ✅ | ✅ | ✅ | ✅ | ✅ | |
| vendors | ✅ | ✅ | ✅ | ✅ | ✅ | |
| orders | ✅ | ✅ (error-checked) | ✅ (mostly unchecked) | ✅ (unchecked) | ✅ | RFQ-reset side effect on delete |
| order_engineers | ✅ | ✅ | ✅ | — | ✅ | |
| rfqs | ✅ | ✅ | ✅ | ✅ (unchecked) | ✅ | |
| rfq_line_items | ✅ | ✅ | ✅ | ✅ | ✅ | role-based RLS defines no UPDATE/DELETE policies |
| supplier_inquiries | ✅ | ✅ | ✅ | — | ✅ | |
| supplier_quotes | ✅ | ✅ | ✅ | — | ✅ | |
| follow_up_actions | pending-only (L200) + ad-hoc getAllFollowUps | ✅ | ✅ | ✅ (unchecked) | ✅ | pending-only load breaks getPatternInsights |
| invoices | ✅ | ✅ (checked) | ✅ (unchecked) | ✅ (unchecked) | ✅ | |
| expenses | ✅ | ✅ (checked) | ✅ (unchecked) | ✅ (unchecked) | ✅ | |
| payment_records | ✅ | ✅ (checked) | — | — | ✅ | write-once by design |
| payables | ✅ | ✅ (checked) | ✅ (checked) | ✅ (checked) | ✅ | best-handled table |
| quarterly_targets | `DashboardPage.tsx:181-209` | upsert `:213-226` (result unchecked) | (upsert) | — | ❌ | page-level bypass of the data layer; no DDL in repo |
| budgets | — | — | — | — | ❌ | table exists; never accessed |
| payable_payments | — | — | — | — | ❌ | typed input exists; never inserted |

## Edge Function

| Route | Method | Auth | Validation | Notes |
|---|---|---|---|---|
| `functions/v1/create-user` | POST | Bearer JWT; verifies caller role=admin server-side (index.ts:49-60+) | basic | Uses service key via Deno.env (correct); CORS `*` (acceptable, could tighten) |

## Cross-cutting API findings

- **Unchecked responses:** ~25 write paths ignore `{ error }` (full list DATABASE_ANALYSIS §8) — with restrictive RLS these fail silently.
- **Duplicate-echo on INSERT:** optimistic local insert + realtime INSERT handler both add the row (BUSINESS_LOGIC_AUDIT §1).
- **Unused API surface:** budgets, payable_payments; users realtime; `.rpc()` never used (no server-side functions).
- **Duplicate access paths:** quarterly_targets bypasses CRMContext — the only table accessed from a page.
- **Whole-table SELECTs:** every list endpoint is unpaginated `select('*')`.

**API score: 4/10.**
