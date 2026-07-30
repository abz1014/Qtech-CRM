import { test, expect } from '@playwright/test';
import { ADMIN, HAVE_ADMIN, loginAs, testTag } from './fixtures';

// The core revenue workflow, end to end: RFQ -> supplier quote -> convert to
// order -> advance status -> record a customer payment -> clean everything up.
//
// This is the longest and least-verifiable spec in this suite — it spans 4
// pages and several modals, and every field/selector below was confirmed by
// reading the actual source (RFQsPage.tsx, RFQDetailPage.tsx, OrderDetailPage.tsx,
// FinancePage.tsx) rather than assumed, but it has never been run end-to-end
// against the live app. Run this one FIRST, ALONE, with --headed, and expect
// to need at least one round of fixes from real output — see e2e/README.md.
//
// Runs as admin because payment recording (order_payments) is admin-only at
// the RLS level (supabase/migrations/20260711_finance_rebuild.sql) even
// though RFQ/order creation itself is admin+sales.
//
// Selector notes:
//  - This app's forms use a plain sibling <label> next to each input/select
//    with no for/id association (confirmed from LoginPage.tsx and consistent
//    across every form read for this spec), so getByLabel() cannot find them.
//    Fields with a confirmed placeholder use getByPlaceholder(); selects
//    (which can't have a placeholder) are targeted by a CSS sibling
//    combinator off their label text instead.
//  - The bespoke form modals here (Add RFQ, Convert to Order) are plain
//    <div className="modal-card"> wrappers with NO role="dialog" — only the
//    shared useConfirm() component (used for the Delete confirmations in
//    afterEach) actually sets that ARIA role. getByRole('dialog') is used
//    ONLY for those delete confirmations; form modals are scoped by
//    `.modal-card` instead.
//
// Cleanup: deleting the order cascades its order_payments row (ON DELETE
// CASCADE); deleting the RFQ afterward cascades its supplier_inquiries,
// supplier_quotes and rfq_line_items. Cleanup runs in afterEach so it fires
// even if an earlier step failed, and is itself defensive (checks an element
// is actually visible before acting on it) so a partial run never throws
// inside cleanup and masks the real test failure.

let rfqId: string | undefined;
let orderId: string | undefined;
let clientName: string | undefined;
const rfqNumber = testTag('RFQ');
const poNumber = testTag('PO');

/** Select the option immediately after a label's text, by CSS sibling
 * combinator — this app's <select>s have no accessible name Playwright can
 * use for getByLabel(). Returns the selected option's visible text. */
async function selectFirstRealOption(page: import('@playwright/test').Page, scope: string, labelText: string) {
  const select = page.locator(`${scope} label:has-text("${labelText}") ~ select`).first();
  await select.selectOption({ index: 1 }); // index 0 is always the placeholder option
  return select.locator('option:checked').innerText();
}

test.describe('RFQ -> order -> payment (admin)', () => {
  test.skip(!HAVE_ADMIN, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured — see e2e/README.md');

  test.afterEach(async ({ page }) => {
    // Best-effort, defensive cleanup — never let a cleanup failure hide the
    // real test result, and never assume how far the test actually got.
    if (orderId) {
      await page.goto(`/orders/${orderId}`).catch(() => {});
      const deleteBtn = page.getByRole('button', { name: 'Delete' }).first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Delete order' });
        if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
      }
    }
    if (rfqId) {
      await page.goto(`/rfqs/${rfqId}`).catch(() => {});
      const deleteBtn = page.getByRole('button', { name: 'Delete' }).first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Delete RFQ' });
        if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
      }
    }
  });

  test('create RFQ, log a quote, convert to order, advance status, record payment', async ({ page }) => {
    await loginAs(page, ADMIN);

    await test.step('create the RFQ', async () => {
      await page.goto('/rfqs');
      await page.getByRole('button', { name: 'Add RFQ' }).click();
      const dialog = page.locator('.modal-card');
      await expect(dialog).toBeVisible();

      await dialog.getByPlaceholder('e.g. RFQ-2026-001').fill(rfqNumber);
      // Selecting a real client also auto-fills Company Name / Contact Person.
      clientName = await selectFirstRealOption(page, '.modal-card', 'Client');
      await selectFirstRealOption(page, '.modal-card', 'Assigned To');

      // Two elements read "Add RFQ" (the trigger already clicked, and this
      // submit button) — scope to the dialog's submit button specifically.
      await dialog.locator('button[type="submit"]').filter({ hasText: 'Add RFQ' }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });

      await page.getByText(rfqNumber).first().click();
      await expect(page).toHaveURL(/\/rfqs\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      rfqId = page.url().split('/rfqs/')[1];
      expect(rfqId, 'RFQ id should be captured from the URL after creation').toBeTruthy();
      expect(clientName, 'a real client should have been selected').toBeTruthy();
    });

    await test.step('float to a supplier and log a quote', async () => {
      await page.getByRole('button', { name: 'Contact Supplier' }).click();
      const vendorInput = page.getByPlaceholder('Type vendor name or select...');
      await vendorInput.fill('a'); // broad enough to match at least one of 100+ real vendors
      // The filtered vendor dropdown has no stable class/testid; it renders as
      // <button> elements immediately after this input in document order.
      const firstVendorOption = vendorInput.locator('xpath=following::button[1]');
      await firstVendorOption.waitFor({ state: 'visible', timeout: 5_000 });
      await firstVendorOption.click();
      await page.getByRole('button', { name: 'Log Inquiry' }).click();

      await page.getByRole('button', { name: 'Log Quote' }).click();
      // The "Which supplier replied?" select's aggregated option text is
      // distinctive enough to target directly, without needing getByLabel.
      await page.locator('select').filter({ hasText: 'Which supplier replied?' }).selectOption({ index: 1 });
      await page.getByPlaceholder('Unit Price (PKR)').fill('1000');
      await page.getByPlaceholder(/Lead Time/i).fill('7');
      await page.getByPlaceholder(/Validity/i).fill('30');
      await page.getByRole('button', { name: 'Save Quote' }).click();
      await expect(page.getByRole('button', { name: 'Create Order' })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('convert to an order', async () => {
      await page.getByRole('button', { name: 'Create Order' }).click();
      const dialog = page.locator('.modal-card').filter({ hasText: 'Convert RFQ to Order' });
      await expect(dialog).toBeVisible();

      await selectFirstRealOption(page, '.modal-card', 'Assign to Sales Person');
      await dialog.getByPlaceholder('e.g. 500000').fill('50000');
      await dialog.getByPlaceholder('e.g. PO-2025-001').fill(poNumber);
      await dialog.locator('button[type="submit"]').click(); // only one submit button in this modal
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    });

    await test.step('advance the order status once', async () => {
      await page.goto('/orders');
      await page.getByText(poNumber).first().click();
      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      orderId = page.url().split('/orders/')[1];
      expect(orderId, 'order id should be captured from the URL after conversion').toBeTruthy();

      // New orders always start at 'po_received' (hardcoded in
      // convertRFQToOrder), so the first advance button always reads exactly
      // this — not a guess.
      await page.getByRole('button', { name: 'Move to Procurement' }).click();
      await expect(page.getByText('Procurement', { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('record a customer payment via Finance', async () => {
      await page.goto('/finance');
      // The Receivables section is collapsible and defaults open; only
      // toggle it if "Record Payment" buttons aren't already visible.
      const anyRecordButton = page.getByRole('button', { name: 'Record Payment' }).first();
      if (!(await anyRecordButton.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /Receivables/ }).click();
      }
      // Locate the receivable row for OUR order by the client name captured
      // at RFQ creation (the row's own visible fields weren't confirmed to
      // include the PO number, but the client name is a standard list-row
      // label throughout this app).
      const row = page.locator('tr, li, div').filter({ hasText: clientName! }).filter({ has: page.getByRole('button', { name: 'Record Payment' }) }).first();
      await row.getByRole('button', { name: 'Record Payment' }).click();

      const dialog = page.locator('.modal-card').filter({ hasText: 'Record Customer Payment' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      // Amount is pre-filled with the outstanding balance by openPayModal —
      // submitting as-is is the realistic "pay in full" path.
      await dialog.getByRole('button', { name: 'Save Payment' }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    });
  });
});
