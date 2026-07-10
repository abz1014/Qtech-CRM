# DATABASE_ANALYSIS.md — Q-Tech CRM (Read-Only Audit)

> **Scope caveat:** Derived from SQL scripts, docs, and TypeScript in the repo. The live Supabase state (which scripts ran, in what order, which policies are active) **cannot be fully verified from the repo** — the SQL files are "paste into SQL Editor" scripts, not tracked migrations, and several conflict with each other.
> Session-verified facts (from live SQL run during this audit): `quarterly_targets` exists with data and has select/insert/update policies (no DELETE policy); 8 production orders have both `customer_po_date` and `confirmed_date` NULL.

## 1. Schema — Core CRM tables (`supabase/schema.sql`)

| Table | PK | FKs | Constraints | Flags |
|---|---|---|---|---|
| `users` (L5-11) | id UUID | — | email UNIQUE, role CHECK (admin/sales/engineer) | **Plaintext `password TEXT` column (L10)** — drop was a manual step, no evidence it ran |
| `clients` (L14-24) | id | created_by → users SET NULL | text cols NOT NULL DEFAULT '' | |
| `prospects` (L27-39) | id | assigned_to → users; converted_client_id → clients | status CHECK hot/warm/cold | follow_up_date is TEXT |
| `vendors` (L42-51) | id | — | | |
| `orders` (L54-67) | id | client_id → clients SET NULL; vendor_id → vendors; sales_person_id → users | | `confirmed_date` nullable TEXT; **`rfq_id` has NO FK** (L53 comment: circular-dep avoidance, never backfilled) |
| `order_engineers` (L70-79) | id | order_id → orders CASCADE; engineer_id → users | commissioning_status CHECK | dates TEXT |
| `rfqs` (L82-97) | id | client_id → clients; assigned_to → users | priority CHECK; status CHECK (new/in_progress/quoted/lost/converted) | **`converted_order_id` has NO FK** (L95); rfq_date TEXT NOT NULL DEFAULT '' |
| `rfq_line_items` (L100-108) | id | rfq_id → rfqs CASCADE | | |
| `supplier_inquiries` (L111-120) | id | rfq_id → rfqs CASCADE; vendor_id → vendors | status CHECK | sent_at/follow_up_date TEXT |
| `supplier_quotes` (L123-137) | id | rfq_id → rfqs CASCADE; vendor_id → vendors; inquiry_id → supplier_inquiries SET NULL | | received_at TEXT |

## 2. Bookkeeping tables (`supabase/migrations/create_bookkeeping_tables.sql`)

| Table | Flags |
|---|---|
| `invoices` (L7-25) | `rfq_id` no FK; issued/due dates TEXT; **no UNIQUE on invoice_number** (and app generates numbers from client-side array length → duplicate risk) |
| `expenses` (L28-47) | `rfq_id` no FK; date TEXT |
| `payment_records` (L50-59) | invoice_id → invoices CASCADE; payment_date TEXT |
| `payables` (L62-78) | **Conflicts with `PAYABLES_SQL_SETUP.md` L13-38 variant** (NOT NULL vendor, CHECK amount > 0, CHECK amount_paid <= amount, DATE types, 5 indexes, admin RLS). Both use CREATE TABLE IF NOT EXISTS — whichever ran first won; production shape UNVERIFIABLE |
| `budgets` (L81-90) | **No UNIQUE on (period, budget_type, category)** — duplicates possible. Not loaded by CRMContext; BudgetForm doesn't persist |
| `follow_up_actions` (L93-109) | **`entity_id` has no FK / no composite constraint with entity_type** — orphan cleanup is app-side only |

## 3. Tables/columns used in code with NO DDL in the repo (UNVERIFIABLE)

- **`quarterly_targets`** — used by `DashboardPage.tsx` (select/upsert, onConflict year,quarter). Created manually. Session-verified live: has select(all)/insert(admin)/update(admin) policies; **no DELETE policy**. DDL should be committed to `supabase/migrations/`.
- **`payable_payments`** — RLS enabled in `enable_rls_security_policies.sql:25` but **no CREATE TABLE and no policies** (if it exists, it is fully locked). App's `recordPayablePayment` doesn't insert into it — updates `payables` directly, so AP payment history is not persisted.
- **orders columns** used in code but absent from schema.sql: customer_po_number, customer_po_date, payment_terms_days, delivery_date, payment_due_date, material/engineering/logistics/overhead/total cost, profit, profit_margin, created_by — added via untracked ALTERs.
- **rfqs columns**: rfq_number, quoted_price, quote_sent_date, quote_expiry_date, loss_reason, loss_notes, created_by — same.
- **supplier_quotes**: is_recommended, value_score — same.

## 4. RLS Posture — TWO CONFLICTING REGIMES in the repo

1. **Open regime** (`supabase/schema.sql` L140-180): RLS enabled but `allow_all USING (true)` on all 10 CRM tables. Bookkeeping tables: ALL for any authenticated user.
2. **Role-based regime** (`supabase/migrations/enable_rls_security_policies.sql`): per-table role checks via subquery on `users`.

Which is live is UNVERIFIABLE from the repo. **Critical implication of the role-based regime:** it defines almost **no DELETE policies** (orders, invoices, expenses, payables, supplier_inquiries, supplier_quotes, rfq_line_items, follow_up_actions have none) and no UPDATE policies for rfq_line_items/order_engineers/payment_records — yet the app calls delete/update on all of these. Because most CRMContext deletes ignore errors, RLS-blocked deletes would fail **silently** (UI shows row gone; it returns on reload — matching a bug the user actually reported: "deleted entries come back next day").

Also: role-check policies reference `created_by` columns on rfqs/orders — columns not present in schema.sql (added out-of-band or the policy script errored).

## 5. Missing FKs (confirmed from tracked SQL)

- `orders.rfq_id` ↔ `rfqs.converted_order_id` (both directions dangle; app patches manually in `deleteOrder`, CRMContext.tsx:849-855)
- `follow_up_actions.entity_id`
- `invoices.rfq_id`, `expenses.rfq_id`

## 6. Date handling

- Nearly all date columns are TEXT — no DB validation; string comparison only works for strict YYYY-MM-DD.
- `orders.confirmed_date` and `customer_po_date` both nullable → 8 legacy prod rows have both NULL; they silently drop out of any date-filtered metric (root cause of the "Q1 target achieved = 0" bug found during this session; app now falls back to linked RFQ date).
- App computes "today" via `new Date().toISOString().split('T')[0]` — **UTC**, not Pakistan (UTC+5). Between 00:00 and 05:00 PKT the app's "today" is yesterday; every daily metric and due-date comparison shifts.

## 7. Indexes

Tracked SQL contains only: `idx_followup_recurrence` (partial, phase3) + the 5 payables indexes (only if the PAYABLES_SQL_SETUP variant ran). **Missing** (recommended): rfqs(rfq_date), rfqs(client_id), rfqs(status), orders(client_id), orders(status), orders(created_at), follow_up_actions(status, due_date), follow_up_actions(entity_type, entity_id), invoices(due_date/payment_status/client_id), expenses(date), payment_records(invoice_id), and all child-table rfq_id FKs. Impact is modest at current scale (app loads whole tables) but FK columns without indexes slow the CASCADEs.

## 8. Data access layer (`src/contexts/CRMContext.tsx`)

- **Initial load (L171-221):** 15 parallel `select('*')` whole-table queries; errors swallowed (`data ?? []`) — a failing table silently renders empty.
- **Realtime:** one channel, 14 listeners (L229-424). NOT subscribed: users, quarterly_targets, budgets. **Bug: channel cleanup (L440-442) is returned from the inner async `load()`, not the useEffect — unsubscribe never runs; channels leak on unmount/HMR.**
- **~25 writes with no error handling** (pattern `const { data } = await …; if (data) setState(…)`): addClient L457, addProspect L498, addOrderEngineer L535, convertProspect L542, updateOrderStatus L587, updateCommissioningStatus L608, addRFQ L618, updateRFQStatus L640, updateRFQPriority L659, addSupplierQuote L715, updateSupplierQuote L720, addRFQLineItem L730, updateRFQLineItem L735, updateInquiryStatus L745, updateSupplierInquiry L755, updateClient/Vendor/Prospect/RFQ/Order L783-831, updateInvoice L932, updateExpense L964, applySequence L684.
- **Deletes that mutate local state even when the DB delete failed:** deleteRFQLineItem L739, deleteRFQ L833, deleteOrder L842, deleteClient L864, deleteVendor L890, deleteProspect L895, deleteInvoice L941, deleteExpense L973.
- **N+1 / sequential:** deleteClient loops per-RFQ/per-order awaits (L870-875) — could be `.in()` batches; no transaction, partial failure leaves inconsistent state.
- **Anti-pattern:** deleteOrder fires an un-awaited `rfqs.update()` **inside a `setOrders` state-updater callback** (side effect in reducer; result unchecked).
- **Race conditions:** recordPayment computes `amount_paid` from client-side state (L993-1016) — concurrent users corrupt totals; getNextInvoiceNumber derives sequence from array length (L904-912) with no UNIQUE backstop; completeFollowUp recurrence parses a `__recur:N__` magic string from description (L1587) while the DB `recurrence_days` column goes unused.
- **Optimistic insert + realtime echo:** addOrder/addRFQ etc. prepend locally AND the realtime INSERT listener prepends again — duplicate rows in UI until reload (dedup by id not implemented).

## 9. Severity Summary

| Severity | Finding |
|---|---|
| Critical (conditional) | Plaintext users.password column if the manual drop never ran |
| Critical | Silent-failure writes/deletes across CRMContext (matches reported "deleted data comes back" bug) |
| High | Two conflicting RLS regimes; missing DELETE/UPDATE policies vs app behavior |
| High | Realtime channel leak (unsubscribe never runs) |
| High | Duplicate-row echo from optimistic insert + realtime INSERT |
| High | No migration tracking — DDL drift between repo and prod (quarterly_targets, order/rfq columns) |
| Medium | Missing FKs (rfq_id, converted_order_id, entity_id) |
| Medium | TEXT dates; UTC "today" vs PKT business day |
| Medium | Invoice-number and payment-total race conditions |
| Low | Missing indexes at current scale |

## 10. Scores (1-10)

| Area | Score |
|---|---|
| Database design | 4 |
| Data integrity | 3 |
| API/data-access layer | 4 |
