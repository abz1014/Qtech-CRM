import { test, expect } from '@playwright/test';
import { SALES, ENGINEER, HAVE_SALES, HAVE_ENGINEER, loginAs } from './fixtures';

// App.tsx's RequireRole is explicitly documented in the codebase as a
// client-side UX guard only ("stops a user typing /finance") — the real
// enforcement is Postgres RLS (see T0-1/T0-2). This spec exists to catch a
// REGRESSION in that UX layer, not to re-prove the RLS work; a failure here
// wouldn't be a data leak, just a broken redirect a real user would notice.

test.describe('Role guards redirect correctly', () => {
  test.skip(!HAVE_SALES, 'E2E_SALES_EMAIL / E2E_SALES_PASSWORD not configured — see e2e/README.md');

  test('sales hitting an admin-only route is redirected to the dashboard', async ({ page }) => {
    await loginAs(page, SALES);
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/dashboard$/);
    // Confirms it's a real redirect, not a blank/broken page.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('sales hitting the admin-only Employees route is also redirected', async ({ page }) => {
    await loginAs(page, SALES);
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('sales CAN reach the routes their role actually needs', async ({ page }) => {
    // The other failure direction: a future tightening of RequireRole must
    // not lock sales out of their real job.
    await loginAs(page, SALES);
    for (const path of ['/rfqs', '/orders', '/clients', '/gst-register']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });
});

test.describe('Engineer role guard', () => {
  // No engineer account exists in the live database as of this writing (see
  // supabase/audit/T0-1_CONFIRMED.md) — this spec is written and ready, but
  // will only ever run once one is created and its credentials configured.
  test.skip(!HAVE_ENGINEER, 'No engineer test account configured (or none exists yet) — see e2e/README.md');

  test('engineer is redirected straight to My Jobs after login', async ({ page }) => {
    await loginAs(page, ENGINEER);
    await expect(page).toHaveURL(/\/my-jobs$/);
  });

  test('engineer hitting an admin-only route is redirected to My Jobs, not the dashboard', async ({ page }) => {
    // RequireRole(['engineer','admin']) on /my-jobs; admin-only routes should
    // still bounce an engineer, and DashboardPage itself re-redirects engineers
    // away from /dashboard, so the effective landing spot is /my-jobs.
    await loginAs(page, ENGINEER);
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/my-jobs$/);
  });
});
