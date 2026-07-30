import type { Page } from '@playwright/test';

// Shared login helper + credential-presence flags for every spec in this
// directory. See e2e/README.md for how to configure these accounts.
//
// Note these are PLAIN env vars (process.env), not VITE_-prefixed — Playwright's
// test runner doesn't go through Vite, so import.meta.env isn't available here.
// The dedicated sales test account can be the SAME real account referenced by
// the Vitest RLS suite (src/test/rls.integration.test.ts) under its
// VITE_RLS_TEST_SALES_* names — one throwaway account, two env var names.

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
export const SALES = {
  email: process.env.E2E_SALES_EMAIL,
  password: process.env.E2E_SALES_PASSWORD,
};
export const ENGINEER = {
  email: process.env.E2E_ENGINEER_EMAIL,
  password: process.env.E2E_ENGINEER_PASSWORD,
};

export const HAVE_ADMIN = Boolean(ADMIN.email && ADMIN.password);
export const HAVE_SALES = Boolean(SALES.email && SALES.password);
export const HAVE_ENGINEER = Boolean(ENGINEER.email && ENGINEER.password);

/**
 * Logs in via the real UI form and waits for the post-login redirect. Throws
 * (failing the test with a clear message) if login doesn't complete — no
 * silent partial state.
 */
export async function loginAs(page: Page, creds: { email?: string; password?: string }) {
  if (!creds.email || !creds.password) {
    throw new Error('loginAs() called without credentials — this should have been guarded by a HAVE_* skip');
  }
  await page.goto('/');
  await page.getByPlaceholder('Enter your email').fill(creds.email);
  await page.getByPlaceholder('Enter your password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // While unauthenticated, every path renders LoginPage without navigating
  // (App.tsx's ProtectedRoutes gates on `user` before the route tree, incl.
  // the `/` -> `/dashboard` redirect, is ever reached). So the URL actually
  // leaving `/` is a reliable signal that auth succeeded and the app rendered
  // its real route tree — engineers then get redirected on to /my-jobs by
  // DashboardPage itself, which is why we check "left /", not one fixed target.
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Sign Out' }).waitFor({ state: 'visible', timeout: 15_000 });
}

/** A short, sortable, greppable marker so any test-created row is unmistakable
 * and any leftover from a failed run is trivially findable and safe to
 * hand-delete. Never reuses a value across runs. */
export function testTag(label: string): string {
  return `E2E-${label}-${Date.now()}`;
}
