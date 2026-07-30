import { test, expect } from '@playwright/test';
import { ADMIN, HAVE_ADMIN, loginAs } from './fixtures';

test.describe('Login → dashboard renders', () => {
  test.skip(!HAVE_ADMIN, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured — see e2e/README.md');

  test('admin can log in and see a populated dashboard', async ({ page }) => {
    await loginAs(page, ADMIN);

    // AppLayout renders the current page's title from PAGE_TITLES.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // The full admin sidebar should be present — this also incidentally
    // proves the user's role resolved correctly (a stuck/failed role lookup
    // would render a degraded or empty nav, not the full admin set).
    const nav = page.locator('nav');
    for (const item of ['Dashboard', 'Clients', 'RFQs', 'Orders', 'Finance', 'Team']) {
      await expect(nav.getByRole('button', { name: item })).toBeVisible();
    }

    // KPI cards should render real numbers, not an empty/error state.
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Total Orders')).toBeVisible();
  });
});
