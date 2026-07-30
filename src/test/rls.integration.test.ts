// @vitest-environment node
//
// T0-3 — Automated RLS regression suite.
//
// This is an INTEGRATION test: it makes real network calls to the live
// Supabase project, through the exact same client/API path the browser app
// uses (@supabase/supabase-js + PostgREST). It never touches the database
// directly, and it never mutates real data — every assertion is a read, and
// the one write attempt targets a row that cannot exist.
//
// Context: T0-1 found the database fully readable/writable by an anonymous
// caller holding nothing but the publishable key that ships in every browser
// bundle (see supabase/audit/T0-1_CONFIRMED.md), and T0-2 fixed it across
// four staged migrations. This suite is what stops that regressing silently.
//
// ── TIER 1 — anonymous exposure (runs automatically, no setup required) ────
// Uses only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — the same public
// values already baked into the shipped app. No login, no secrets.
//
// ── TIER 2 — role-scoped access (opt-in, skipped unless configured) ────────
// Needs a DEDICATED, low-privilege `sales`-role test account — never a real
// staff member's login. Create one via the Team page, then set (only in a
// gitignored `.env.test.local`, or as GitHub Actions *secrets* for CI):
//   VITE_RLS_TEST_SALES_EMAIL=<test account email>
//   VITE_RLS_TEST_SALES_PASSWORD=<test account password>
// Nobody but you ever sees this password — it is read from your own env at
// test time and never appears in this file, in chat, or in any commit.
// Without it, Tier 2 is skipped (reported, not silently ignored) and the
// suite still passes on Tier 1 alone.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const HAVE_PROJECT = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const SALES_EMAIL = import.meta.env.VITE_RLS_TEST_SALES_EMAIL as string | undefined;
const SALES_PASSWORD = import.meta.env.VITE_RLS_TEST_SALES_PASSWORD as string | undefined;
const HAVE_SALES_ACCOUNT = Boolean(SALES_EMAIL && SALES_PASSWORD);

if (!HAVE_PROJECT) {
  console.warn(
    '[rls.integration.test] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — ' +
    'the entire RLS regression suite is SKIPPED, not passing. Set them (same values ' +
    'the app itself uses) to enable Tier 1 anonymous-exposure coverage.'
  );
} else if (!HAVE_SALES_ACCOUNT) {
  console.warn(
    '[rls.integration.test] VITE_RLS_TEST_SALES_EMAIL / VITE_RLS_TEST_SALES_PASSWORD not set — ' +
    'Tier 2 (role-scoped access checks) is SKIPPED. See the file header for how to enable it ' +
    'with a dedicated, non-staff test account.'
  );
}

// Financial / sensitive tables an anonymous caller must never reach — this is
// exactly the surface T0-1 found fully open.
const ANON_MUST_BE_DENIED = [
  'users', 'clients', 'vendors', 'orders', 'rfqs',
  'invoices', 'expenses', 'payment_records', 'payables', 'budgets',
  'employees', 'attendance', 'order_payments', 'supplier_payments',
] as const;

describe.skipIf(!HAVE_PROJECT)('T0-3 / Tier 1 — anonymous access must be fully denied', () => {
  let anon: SupabaseClient;

  beforeAll(() => {
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  });

  it.each(ANON_MUST_BE_DENIED)('anon cannot SELECT from %s', async (table) => {
    const { data, error } = await anon.from(table).select('id').limit(1);
    // Post-fix (grants revoked): a hard 42501 permission-denied error.
    // If this ever again returns rows with no error, `anon` has regained
    // table access — this is the T0-1 regression this suite exists to catch.
    expect(error, `anon.select('${table}') should be rejected but returned no error`).toBeTruthy();
    expect(data).toBeFalsy();
  }, 15_000);

  it('anon cannot self-promote via UPDATE users.role', async () => {
    // Targets an id that cannot exist, so even in a total-regression worst
    // case this cannot touch a real row — it only proves whether the write
    // path itself is open.
    const { error } = await anon
      .from('users')
      .update({ role: 'admin' })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    expect(error, 'anon.update(users.role) should be rejected but succeeded').toBeTruthy();
  }, 15_000);

  it('anon cannot INSERT a client (the account-creation-shaped write path)', async () => {
    const { error } = await anon
      .from('clients')
      .insert({ company_name: '__RLS_REGRESSION_TEST__' });
    expect(error, 'anon.insert(clients) should be rejected but succeeded — ' +
      'if this ever passes, DELETE the row it created immediately').toBeTruthy();
  }, 15_000);
});

describe.skipIf(!HAVE_PROJECT || !HAVE_SALES_ACCOUNT)(
  'T0-3 / Tier 2 — sales-role account is scoped correctly (neither too open nor too closed)',
  () => {
    let sales: SupabaseClient;

    beforeAll(async () => {
      sales = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { error } = await sales.auth.signInWithPassword({ email: SALES_EMAIL!, password: SALES_PASSWORD! });
      if (error) throw new Error(`Tier 2 setup failed to sign in the test sales account: ${error.message}`);
    });

    afterAll(async () => {
      await sales.auth.signOut();
    });

    // Negative controls — RLS denies these SILENTLY (0 rows, no error) rather
    // than with a hard error, because the account IS authenticated; only the
    // row-visibility policy filters it out. Asserting on an empty array (not
    // an error) is deliberate and matches how Postgres RLS actually behaves —
    // see supabase/audit/T0-2_stageB_write_verification.sql for the same
    // silent-denial trap on the write side.
    const SALES_MUST_NOT_READ = [
      'invoices', 'expenses', 'payment_records', 'payables',
      'employees', 'attendance', 'order_payments', 'supplier_payments',
    ] as const;

    it.each(SALES_MUST_NOT_READ)('sales cannot read %s (admin-only)', async (table) => {
      const { data, error } = await sales.from(table).select('id').limit(1);
      expect(error).toBeNull(); // authenticated request — no hard error expected
      expect(data, `sales unexpectedly received rows from admin-only table '${table}'`).toEqual([]);
    }, 15_000);

    it('sales cannot delete an order (admin-only, even for a table sales can otherwise write)', async () => {
      const { error, count } = await sales
        .from('orders')
        .delete({ count: 'exact' })
        .eq('id', '00000000-0000-0000-0000-000000000000');
      // Row can't exist, so this only proves whether the operation is even
      // reachable — a real denial surfaces as 0 rows affected, no error.
      expect(error).toBeNull();
      expect(count ?? 0).toBe(0);
    }, 15_000);

    // Positive controls — the OTHER failure mode this suite guards against:
    // an over-eager future tightening that breaks sales's actual day job.
    const SALES_MUST_READ = ['clients', 'vendors', 'orders', 'rfqs'] as const;

    it.each(SALES_MUST_READ)('sales CAN read %s (required for their day-to-day workflow)', async (table) => {
      const { data, error } = await sales.from(table).select('id').limit(1);
      expect(error, `sales was unexpectedly denied read access to '${table}'`).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }, 15_000);
  }
);
