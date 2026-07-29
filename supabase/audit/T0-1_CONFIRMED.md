# T0-1 — CONFIRMED Live RLS State

**Status:** ✅ Audit complete. Observed against the live database (project `vptyhluvgnjpvkcbhxsf`).
**Source:** 7 catalog queries run in the Supabase SQL Editor.
**Headline:** 🔴 **The predicted exposure is real and live.**

---

## 1. What's good (confirmed)

| Check | Result |
|---|---|
| RLS enabled | ✅ **28 / 28 tables** — `tables_rls_off = 0` |
| Plaintext password column | ✅ **GONE** — `plaintext_password_cols = 0` |
| Secret/service key in client bundle | ✅ Not present |
| Key format | ✅ Modern `sb_publishable_…` (not a legacy JWT anon key) |
| Correctly-gated tables | ✅ `order_payments`, `supplier_payments`, `cost_lines`, `costing_config`, `employees`, `attendance`, `gst_invoices` |

**Ticket T0-4 (drop plaintext password column) is already complete.** Close it.

---

## 2. What's broken (confirmed)

RLS being *enabled* is worthless here, because the policies attached to it grant everything.

### 🔴 A. Anonymous — no login required

Ten tables carry a live policy:

```
allow_all | FOR ALL | roles={public} | USING (true) | WITH CHECK (true)
```

`{public}` includes the `anon` role. `FOR ALL` covers SELECT + INSERT + UPDATE + DELETE. Both `USING` and `WITH CHECK` are `true`.

**Affected:** `users` · `clients` · `prospects` · `vendors` · `orders` · `order_engineers` · `rfqs` · `rfq_line_items` · `supplier_inquiries` · `supplier_quotes`

Query 6 confirms `anon` also holds table-level `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on **every** table — so nothing beneath RLS blocks it either.

**Consequences, in plain terms — anyone holding the publishable key that ships in the browser bundle can:**
- Read your **entire customer list, supplier list, RFQ history and order book** — including `order_value`, `cost_value`, `order_gst_amount` (i.e. **revenue, cost and margin on every deal**).
- **Modify or delete** any of it.
- `UPDATE users SET role='admin'` — **self-promote to administrator**, because `WITH CHECK (true)` permits it and the app reads its role from this table.

`quarterly_targets` additionally has `quarterly_targets_select USING (true)` → company revenue targets readable with no login.

### 🔴 B. Any authenticated user — including `engineer`

Six finance tables carry:

```
allow_auth_<table> | FOR ALL | USING (auth.uid() IS NOT NULL) | WITH CHECK = null
```

With `WITH CHECK` null on a `FOR ALL` policy, Postgres reuses the `USING` expression for writes. So **every logged-in user of any role** can read, insert, update **and delete**:

`invoices` · `expenses` · `payment_records` · `payables` · `budgets` · `follow_up_actions`

Most serious: **any engineer can delete `payment_records`** — destroying the cash-receipt audit trail — and read/alter `expenses` rows in the `Salaries` category.

Broad reads also exist on `payable_payments`, `recurring_expenses` (salary templates), `documents`, and via `allow_read_*` policies on `clients`/`orders`/`prospects`/`order_engineers`.

### Why the admin policies don't help

The role-based policies **do** exist (`Admin read invoices`, `Admin update payables`, `clients_delete_admin`, …). They are simply **irrelevant**: Postgres combines PERMISSIVE policies with **OR**, so `allow_all`/`allow_auth_*` grants access regardless of what any stricter policy says.

---

## 3. Corrections to earlier analysis

| Earlier claim | Corrected |
|---|---|
| "Plaintext `password` column still exists" | ❌ **Wrong — it's already dropped.** T0-4 done. |
| "`enable_rls_security_policies.sql` never ran" | ⚠️ Partly wrong. A role-based layer *is* present, but under **different policy names** than that file uses (live: `Admin read invoices`; repo: `Authenticated users can read invoices`). A different script ran — likely from `docs/`. The live version is actually *stricter* than the repo's (admin-only reads on finance). |
| "Query 2 found 39 permissive policies" | ⚠️ My query over-matched: it flagged `qual IS NULL`, which is normal for INSERT policies (they use `WITH CHECK`). **The real nullifiers number 17**: 10 × `allow_all` + 6 × `allow_auth_*` + `quarterly_targets_select`. |
| Table inventory | Two tables exist in the DB but not in repo migrations: **`audit_log`** and **`documents`**. Undocumented drift. |

---

## 4. Recommended immediate mitigation (proposed — not yet applied)

Two steps, smallest-risk first.

### Step 1 — Revoke `anon` (kills the anonymous hole; near-zero breakage risk)

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

**Why this is safe:** every route in the app is behind `ProtectedRoutes` — there is no unauthenticated data path. Login goes through Supabase Auth (the `auth` schema, not `public`), and after login the session acts as `authenticated`, not `anon`.

**Effect:** reduces exposure from *"anyone on the internet"* to *"any logged-in employee"* — the single biggest risk reduction available, in one statement.

**Rollback:**
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
```

### Step 2 — Drop the 17 permissive policies (T0-2 proper)

⚠️ **Cannot be done blindly.** Several tables have *no* role-based policy behind the permissive one, so dropping it would break the app or lock the table entirely:

| Table | Gap behind the permissive policy |
|---|---|
| `budgets` | **Only** `allow_auth_budgets` exists → dropping it leaves **zero policies** = table unusable |
| `payment_records` | No UPDATE, no DELETE policy |
| `supplier_inquiries`, `supplier_quotes` | No DELETE policy |
| `payable_payments` | No UPDATE, no DELETE policy |
| `costing_config` | No INSERT, no DELETE policy |
| `users` | UPDATE policy needs verification |

An analysis of the app's actual per-table/per-operation needs is running now; the replacement policies will be authored from that, so we grant least privilege without breaking a workflow.

---

## 5. Test plan before anything is applied

1. Capture current state: `SELECT * FROM pg_policies WHERE schemaname='public'` → save as rollback reference.
2. Apply **Step 1 only**.
3. Regression-test in the live app as **each role**: admin (dashboard, finance, GST, employees), sales (RFQ → order → costing), engineer (my jobs).
4. Re-run audit Query 6 → confirm `anon` no longer appears.
5. Only then proceed to Step 2, table group by table group, testing between each.

---

---

## 6. ✅ STEP 1 APPLIED — 2026-07-29

**Approved and executed.** `REVOKE ALL ON ALL TABLES/SEQUENCES IN SCHEMA public FROM anon` + matching `ALTER DEFAULT PRIVILEGES`.

### Verification

| Check | Result |
|---|---|
| `anon` table grants remaining | **0** — `PASS - anon has no table access` |
| `authenticated` tables | **28** — untouched, exactly as before |

### Live regression test (role: admin)

| Surface | Baseline | After | Verdict |
|---|---|---|---|
| Dashboard KPIs | — | 13 clients · 34 orders · 9 in procurement/transit · Rs 11,510,414 order value | ✅ loads |
| Sidebar nav | 14 items | 14 items incl. Finance, Employees, Team | ✅ role resolution intact |
| GST Register | 28 inv · Rs 1,744,074 | 29 inv · Rs 1,801,674 | ✅ loads (delta explained below) |
| GST sort by invoice # | desc | 152 → 151 → 150 → 149 | ✅ working |
| Pagination | 25/page | "Showing 1-25 of 29" | ✅ working |

**Delta fully accounted for** (not caused by the change):
- **Invoice 136 was corrected** — GST now **167,400** (was 176,400), rate exactly 18.00%. −9,000
- One new invoice added in the interim. +66,600
- Net **+57,600** ✓ reconciles exactly.

**Bonus finding:** all **29 invoices now reconcile at exactly 18%** — zero off-rate rows. The register is arithmetically clean.

**No test artifacts:** scanned all 29 rows — no blank invoice numbers, no residue from the add-form testing.

### Roles not directly re-tested (sales, engineer)

Not exercised, but risk is **negligible by construction**: the change touched **only** the `anon` role. Sales and engineer users authenticate and operate as `authenticated`, whose grants were verified unchanged (28 tables), and **no RLS policy was modified**. There is no mechanism by which their behaviour could differ.

### Residual risk after Step 1

Anonymous access is closed. **Still open:** every logged-in user (any role) retains full read/write/delete on `invoices`, `expenses`, `payment_records`, `payables`, `budgets`, `follow_up_actions` via the `allow_auth_*` policies, plus the 10 `allow_all` policies still grant blanket access to `authenticated`. **That is Step 2 (T0-2 proper).**

---

*Step 1 complete. Step 2 pending — per-table policy replacements, to be authored from the app call-site trace.*
