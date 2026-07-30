# E2E tests (T0-7)

Playwright specs covering the app's core flows. **Read this before running
them** — there is no separate staging environment, so every spec here runs
against the same live Supabase project the deployed app uses.

## What's here

| Spec | What it checks | Mutates data? | Needs |
|---|---|---|---|
| `01-login-dashboard` | Login succeeds, dashboard renders with real KPIs | No | admin |
| `02-role-guards` | Sales/engineer redirected away from routes their role can't use, and NOT locked out of routes they need | No | sales, engineer (optional) |
| `03-rfq-order-payment` | The core revenue workflow: RFQ → supplier quote → convert to order → advance status → record a payment | **Yes** (self-cleaning) | admin |
| `04-gst-invoice` | GST invoice create, the live 18% mismatch warning, register search, delete | **Yes** (self-cleaning) | admin |
| `05-finance-page` | Finance page renders its core sections with real figures | No | admin |

Every spec **self-skips with a clear message** (not a failure) if its required
credentials aren't configured — you can run whichever subset you've set up.

## One-time setup

### 1. A dedicated admin test login

You can use your own real admin account for the **read-only** specs (01, 02,
05) — they never write anything.

**For the mutating specs (03, 04), strongly prefer a separate admin-role
account created just for testing** (via the Team page), rather than your own
login — it makes any leftover test data (already tagged `E2E-...` and
cleaned up automatically) unambiguous, and keeps a real person's login out of
an automated script.

### 2. Optional: a dedicated sales test account

Only needed for the two `02-role-guards` sales checks. Create via the Team
page with `role: sales`. **Never use a real staff member's login here.**

This can be the *same* account referenced by the Vitest RLS suite
(`src/test/rls.integration.test.ts`) — just set its credentials under both
variable names (see below).

### 3. Optional: an engineer test account

No engineer account exists in this system as of this writing. The engineer
specs are written and ready, but will simply keep skipping until one exists.

### 4. Configure credentials

Create `.env.test.local` in the repo root (already gitignored via the
`*.local` pattern in `.gitignore` — never commit this file):

```
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_SALES_EMAIL=
E2E_SALES_PASSWORD=
E2E_ENGINEER_EMAIL=
E2E_ENGINEER_PASSWORD=
```

Only fill in the roles you've set up test accounts for — leave the rest
blank and those specs will skip.

For CI (manually-triggered `E2E (manual)` workflow, see below): add these as
**repository secrets** (Settings → Secrets and variables → Actions →
Secrets) under the same names, and `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` as **repository variables** (same tab, "Variables")
— those two are public by design, same as the running app.

## Running locally

```bash
npx playwright install --with-deps chromium   # once
npm run test:e2e
```

This auto-starts the dev server on **port 8080** (matching `vite.config.ts` —
not the 5173 previously listed in `.claude/launch.json`, which was a stale
mismatch, now fixed) and runs against it.

**Recommended order for a first run:** run the read-only specs first, then
the mutating ones individually with `--headed` so you can watch what happens:

```bash
npx playwright test 01-login-dashboard 02-role-guards 05-finance-page
npx playwright test 04-gst-invoice --headed        # simpler mutating spec
npx playwright test 03-rfq-order-payment --headed  # most complex — run last
```

To point at the deployed app instead of a local dev server:

```bash
BASE_URL=https://qtech-crm.vercel.app npm run test:e2e
```

## About spec 03 specifically

This is the longest, most complex spec — it spans 4 pages and several modals
(RFQ creation → floating to a supplier → logging a quote → converting to an
order → advancing its status → recording a payment). Every selector in it was
confirmed by reading the actual page source, not guessed, but **it has never
been run end-to-end against the live app** (no test credentials were
available while writing it). Expect it may need one round of fixes based on
real output — if it fails, the failure will land inside a named
`test.step()` (visible in the HTML report / trace), which is exactly what to
share to get it fixed quickly.

Its cleanup (in `afterEach`) runs regardless of where the test failed, and is
itself defensive — it checks each delete button is actually visible before
clicking, so a partial run can't throw inside cleanup and hide the real
failure. Any leftover data will be clearly tagged (`E2E-RFQ-<timestamp>`,
`E2E-PO-<timestamp>`) and safe to delete by hand from the UI if a run is
ever interrupted mid-way (e.g. a killed process).

## Running in CI

There's a separate workflow, `.github/workflows/e2e.yml` ("E2E (manual)"),
**not** wired into the regular `push`/`pull_request` CI. Unlike the Vitest
RLS suite (which only reads, and whose one write attempt can never actually
mutate anything since `anon` has zero grants), these specs genuinely create
and delete real records — running that on every single commit was judged too
risky a default. Trigger it manually from the Actions tab when you want to
run it, e.g. before a release.
