# BACKEND_ANALYSIS.md — Q-Tech CRM (Read-Only Audit)

> There is no traditional backend. The "backend" is: Supabase (PostgREST + Auth + Realtime + one Edge Function) with **all business logic living client-side in `CRMContext.tsx`**.

## Components

| Layer | Implementation |
|---|---|
| Controllers/Services | None server-side. `CRMContext.tsx` (~1,636 lines) is the de facto service layer, running in the browser |
| Repositories | Direct `supabase.from()` calls inline in context functions (plus one page-level bypass: quarterly_targets in DashboardPage) |
| Business logic | Client-side: order state machine, RFQ conversion, follow-up automation, invoice numbering, payment status math |
| Middleware/Validation | None server-side beyond RLS + column CHECKs. No zod on writes (only Login) |
| Error handling | ~25 writes ignore errors; deletes mutate local state on failure (full list in DATABASE_ANALYSIS §8) |
| Logging | console.error only (23 calls, mostly swallowed) |
| Background tasks | None. "Automation" fires only during user interactions in the browser |
| Edge Functions | `supabase/functions/create-user/index.ts` — verifies caller is admin server-side, uses service key via Deno.env (correct pattern); CORS `*` |

## Structural risks of the client-side-logic architecture

1. **Trust boundary:** every rule (invoice numbers, payment totals, order transitions, follow-up creation) is enforceable only by RLS; a user with the anon key + PostgREST can bypass all of it.
2. **Concurrency:** no transactions, no server-side sequences — invoice numbering and payment totals race (see BUSINESS_LOGIC_AUDIT §5).
3. **Consistency:** multi-step operations (deleteClient cascade, convertRFQToOrder, deleteOrder+RFQ-reset) are non-atomic; partial failures leave inconsistent state.
4. **Timezone:** "server time" is each browser's clock serialized as UTC — no canonical business clock.

## Recommendations (roadmap items, not changes)

- Move invoice numbering to a Postgres sequence/trigger; payment totals to a DB view or trigger-maintained column.
- Convert multi-step deletes/conversions into Postgres functions (`.rpc()`) for atomicity.
- Introduce a single `businessToday()` helper (Asia/Karachi) as step 1; server-derived time later.

**Backend score: 3/10** — not broken, but everything that should be server-authoritative is client-authoritative.
