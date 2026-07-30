import { test, expect } from '@playwright/test';
import { ADMIN, HAVE_ADMIN, loginAs, testTag } from './fixtures';

// GST invoice: create with a deliberately wrong GST amount, confirm the live
// 18% consistency warning fires (added earlier — see supabase/audit history
// and the GstRegisterPage session work), confirm "Use 18%" fixes it, save,
// confirm it appears in the register, then delete it.
//
// Higher confidence than spec 03: this page's exact field labels, the search
// box, and the warning text were all directly authored and live-verified
// (via the in-app browser) in this same working session — see the "GST form:
// live 18% consistency check" commit. Still self-cleaning: this is real
// production data (the GST register feeds actual FBR tax-filing tracking).

const invoiceNumber = testTag('GST');

/** Fill an <input> immediately following a label's text — this page's form
 * fields have no placeholder or for/id association Playwright can key off. */
async function fillFieldByLabel(page: import('@playwright/test').Page, scope: string, labelText: string, value: string) {
  await page.locator(`${scope} label:text-is("${labelText}") ~ input`).first().fill(value);
}

test.describe('GST invoice: create, 18% warning, register, delete', () => {
  test.skip(!HAVE_ADMIN, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured — see e2e/README.md');

  test('warns on a mismatched GST amount, fixes it, saves, then deletes cleanly', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/gst-register');

    await test.step('create with a deliberately wrong GST amount', async () => {
      await page.getByRole('button', { name: 'Add Invoice' }).click();
      const dialog = page.locator('.modal-card');
      await expect(dialog).toBeVisible();

      await fillFieldByLabel(page, '.modal-card', 'GST invoice #', invoiceNumber);
      await fillFieldByLabel(page, '.modal-card', 'Amount (incl GST)', '100000');
      await fillFieldByLabel(page, '.modal-card', 'GST amount', '50000'); // correct 18% value would be ~15254

      await expect(dialog.getByText(/doesn.t match 18% of net/)).toBeVisible({ timeout: 5_000 });
    });

    await test.step('"Use 18%" corrects it', async () => {
      const dialog = page.locator('.modal-card');
      await dialog.getByRole('button', { name: /^Use 18%/ }).click();
      // The mismatch banner is replaced by the quiet ✓ variant once corrected.
      await expect(dialog.getByText(/doesn.t match 18% of net/)).toBeHidden({ timeout: 5_000 });
      await expect(dialog.getByText(/GST at 18%/)).toBeVisible();

      await dialog.getByRole('button', { name: 'Add to register' }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    });

    await test.step('appears in the register', async () => {
      await page.getByPlaceholder(/Search invoice #/).fill(invoiceNumber);
      const row = page.locator('table tbody tr').filter({ hasText: invoiceNumber });
      await expect(row).toHaveCount(1, { timeout: 10_000 });
    });

    await test.step('delete it', async () => {
      const row = page.locator('table tbody tr').filter({ hasText: invoiceNumber });
      await row.getByTitle('Delete').click();
      const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Delete invoice?' });
      await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
      await confirmDialog.getByRole('button', { name: 'Delete invoice' }).click();
      await expect(row).toHaveCount(0, { timeout: 10_000 });
    });
  });
});
