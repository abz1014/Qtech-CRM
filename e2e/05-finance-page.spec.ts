import { test, expect } from '@playwright/test';
import { ADMIN, HAVE_ADMIN, loginAs } from './fixtures';

// Finance page loads with real AR/AP-shaped data. This deliberately does NOT
// assert specific numbers — real business figures change daily, so a fixed
// expected total would be either wrong by tomorrow or quietly disconnected
// from what's actually being checked. Instead it asserts the page's core
// sections render and show plausible PKR-formatted figures, which is what
// actually breaks if a query, a join, or an RLS policy regresses.

test.describe('Finance page loads correctly (admin)', () => {
  test.skip(!HAVE_ADMIN, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured — see e2e/README.md');

  test('core sections render with PKR-formatted figures, no error state', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/finance');

    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();

    // The receivables section (AR) — exact text confirmed in FinancePage.tsx.
    await expect(page.getByText('Receivables — Customers Owe Us')).toBeVisible();
    // Expenses, Cash Flow and Profit & Loss sections must all render too —
    // together these cover every money figure this page is responsible for.
    await expect(page.getByText('Expenses', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Cash Flow/)).toBeVisible();
    await expect(page.getByText(/^Profit & Loss/)).toBeVisible();

    // At least one real PKR-formatted figure should be on the page — proves
    // actual data loaded, not just empty section shells.
    await expect(page.getByText(/Rs\s[\d,]+/).first()).toBeVisible();

    // No visible error/failure toast or message.
    await expect(page.getByText(/failed to load|error loading/i)).toHaveCount(0);
  });
});
