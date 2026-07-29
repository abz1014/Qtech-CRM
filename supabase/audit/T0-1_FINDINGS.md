# T0-1 — RLS Audit Findings (Expected State)

**Status:** ⚠️ **EXPECTED state derived from migration SQL. NOT yet confirmed against the live database.**
**Method:** 7 agents across the full `supabase/` tree — 3 independent inventories, 3 adversarial passes that attempted to *refute* each finding, 1 synthesis. All three refutation attempts failed to refute.
**Verdict counts (expected):** 17 EXPOSED · 3 PARTIAL · 6 SECURE

> Everything below is what the SQL in this repo *would* produce if applied in order. The live database may differ — someone could have fixed this by hand in the dashboard, leaving no repo trace. **Closing that gap is the entire purpose of T0-1.** Run the queries in `T0-1_rls_audit.sql` to convert this from expected to observed.

---

## 1. Headline finding

**The permissive `allow_all` / `allow_auth_*` policies are never dropped anywhere in the repository.**

- Exactly **16** `DROP POLICY` statements exist in the whole repo: 10 in `schema.sql:152-180`, 6 in `create_bookkeeping_tables.sql:124-129`.
- **All 16 are self-drops** sitting immediately above a re-`CREATE` of the identical policy (the idempotency idiom).
- **Zero** migrations remove a permissive policy. Zero `DISABLE ROW LEVEL SECURITY`. Zero `DROP TABLE`.
- The file the docs call the "CRITICAL SECURITY FIX" — `enable_rls_security_policies.sql` — **contains no `DROP POLICY` at all.** It stacks ~30 role-based policies *alongside* the open ones.

**Why this is fatal:** Postgres combines PERMISSIVE policies with **OR**. `allow_all` is declared `FOR ALL USING (true)` with **no `AS RESTRICTIVE`** and **no `TO` clause** — so it is permissive and applies to `PUBLIC`, which includes the `anon` role. Every role-based gate on those tables is therefore **decorative**.

The migration to drop the permissive layer (ticket T0-2) **does not exist**.

---

## 2. The twist: the security script probably never ran at all

`enable_rls_security_policies.sql` almost certainly **cannot execute to completion**:

| Line | Problem |
|---|---|
| `:25` | `ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY` — but `payable_payments` is not created until `20260710_data_integrity_fks.sql:97`. On a DB built from `schema.sql` + `create_bookkeeping_tables.sql`, this errors: *relation does not exist*. |
| `:136, 143, 163, 170, 184, 191, 218, 225` | Eight policy expressions reference a **`created_by` column that no migration ever adds** to `rfqs`, `orders`, `supplier_inquiries`, or `supplier_quotes`. `CREATE POLICY` validates column references at creation time → *column "created_by" does not exist*. |

Pasted into the Supabase SQL editor, the file runs as **one implicit transaction** → any error rolls back **the entire file**.

**So the realistic worst case is not "permissive OR role-based" — it is "permissive ONLY", with the admin gates never installed.**

**Diagnostic:** if a query for policies named `"Admin can %"` returns **zero rows**, this is confirmed.

---

## 3. Expected exposure by table

### 🔴 EXPOSED — readable/writable with **no login at all** (raw publishable key)
`users` · `clients` · `prospects` · `vendors` · `orders` · `order_engineers` · `rfqs` · `rfq_line_items` · `supplier_inquiries` · `supplier_quotes` · `quarterly_targets`

**Worst three:**

1. **`users`** — the most serious. `allow_all` is `FOR ALL`, so anon can `SELECT`/`INSERT`/`UPDATE` every row, including:
   - `password TEXT NOT NULL DEFAULT ''` (`schema.sql:10`) — plaintext-capable credential column
   - the `role` column → **self-promotion to admin is a single PATCH request**
2. **`orders`** — carries `order_value`, `cost_value`, `order_gst_amount`, `invoice_number` → **revenue, cost and margin on every deal**, readable *and writable* by anon. This also largely moots the correct admin-only gating on `order_payments`/`supplier_payments`, since the totals are derivable from `orders`.
3. **`quarterly_targets`** — a live `USING (true)`: company revenue targets readable by PUBLIC. (My backlog called this "intentional" — that should be re-litigated. "Internal CRM" does not make a public PostgREST endpoint private.)

### 🔴 EXPOSED — readable/writable by **any authenticated user** (any role)
`invoices` · `expenses` · `payment_records` · `payables` · `budgets` · `follow_up_actions`

These carry `allow_auth_* FOR ALL USING (auth.uid() IS NOT NULL)` **with no `WITH CHECK`** — so Postgres reuses the `USING` expression as the write check. Consequences:

- Any engineer or sales user can read **and delete** `payment_records` — i.e. **destroy the cash-receipt audit trail**.
- `expenses` includes `category='Salaries'` rows — payroll readable and alterable by all staff.
- `budgets` has **no role-based policy at all** in the entire repo; the permissive one is its only policy.

### 🟡 PARTIAL — writes gated, reads too broad (not nullified)
| Table | Gap |
|---|---|
| `payable_payments` | Writes correctly admin-only. But `SELECT` open to any authenticated user; no UPDATE/DELETE policy (fails closed). |
| `recurring_expenses` | Writes admin-only. But read gate is `authenticated` → **all staff read salary templates**. |
| `costing_config` | Not an exposure — no INSERT/DELETE policy, so the singleton row can never be recreated if lost. Latent functional breakage. |

### 🟢 SECURE — correctly gated, no permissive sibling
`order_payments` · `supplier_payments` · `cost_lines` · `employees` · `attendance` · `gst_invoices`

All were created **after** the permissive block and aren't in its table list. They use `FOR ALL` with both `USING` and `WITH CHECK` gating on `users.role`. **This is the pattern to replicate in T0-2.**

*(Policy question, not a defect: `gst_invoices` exposes tax-deposit amounts and PSIDs to the whole sales team — broader than admin-only. Worth a deliberate decision.)*

---

## 4. Applied-migration state cannot be determined from the repo

- No `schema_migrations` / `supabase_migrations` anywhere; no `supabase/config.toml`.
- `supabase/.temp/` holds only link metadata (project ref `vptyhluvgnjpvkcbhxsf`) and server version fingerprints.
- `.github/workflows/ci.yml` exists but is JS-only (lint → typecheck → test → build) — **no Supabase CLI step, no migration step, no deploy job.**
- Filenames aren't CLI-compatible; five key files have no timestamp prefix and would sort *after* the `2026*` files that depend on them.
- Every file header says *"paste this into the Supabase SQL editor."*

**Git records authorship, never execution.** Hence every verdict here is expected, not observed.

---

## 5. What the live probe must confirm (priority order)

1. **Do `allow_all` policies still exist on the core tables — above all on `users`?**
   → Query 2 in `T0-1_rls_audit.sql`. Any row with `qual = 'true'` confirms the exposure.
2. **Does any policy named `"Admin can %"` exist?** Zero rows ⇒ `enable_rls_security_policies.sql` never ran ⇒ finance tables governed solely by `allow_auth_*`.
3. **Does `public.users.password` still exist?** → Query 5. Sizes T0-4.
4. **Empirical confirmation** — an unauthenticated request against `users` (see §6). If it returns rows, this is a **live breach** and dominates every other item in the backlog.

---

## 6. Empirical check (run yourself)

Read-only. Replace `<PUBLISHABLE_KEY>` with the key from your Supabase dashboard (Settings → API). This is the exact request an anonymous internet caller can make:

```bash
curl -s "https://vptyhluvgnjpvkcbhxsf.supabase.co/rest/v1/users?select=id,email,role&limit=1" -H "apikey: <PUBLISHABLE_KEY>"
```

- Returns `[]` or an error → RLS is holding. Good.
- **Returns a user row → confirmed live exposure. Escalate immediately to T0-2.**

---

## 7. Corrections to MODERNIZATION_BACKLOG.md

| Ticket | Correction |
|---|---|
| **T0-6 (CI)** | **Already largely done** — `.github/workflows/ci.yml` runs lint + typecheck + unit tests + build on push/PR to `main`. Remaining work is only to add the RLS test job from T0-3. Downgrade S → XS. |
| **T0-2** | Larger than estimated. Must drop ~16 permissive policies **and** author the role-based set correctly (fixing the `created_by` and `payable_payments` ordering bugs), because the existing script cannot run. Re-size S–M → **M–L**. |
| **T0-4** | Confirmed present in schema (`schema.sql:10`). Now also a **live exposure** vector, not just hygiene — anon may be able to read and write it. Priority raised. |
| **Tier 3 note** | `quarterly_targets` public-read was described as "intentional." Re-classify as a finding pending your decision. |

---

*Next action: run the queries in `T0-1_rls_audit.sql` (or at minimum Query 2 and Query 5) and paste the output. I will diff observed vs expected and produce the final SECURE/PARTIAL/EXPOSED report, then draft T0-2 with rollback SQL written and tested first.*
