// Stock adjustment helper (Inventory > Manage Stocks).
// UI facts (probe-verified, 7 Nov 2026):
// - A force-update toast ("A new version of Bearon is available") can cover the
//   page. Dismiss it with "Later", NEVER "Update" (that signs the session out).
// - The product picker is a <button role="combobox"> inside the dialog; its
//   search results are div[role=option], not buttons.
// - The quantity input only appears AFTER a product is picked.
// - Reason is a Radix combobox mirrored by a hidden native <select>: Stock
//   Received, Sales Return, Restock Found, Damaged, Expired, Return to Vendor,
//   Stock Shortage. Removal reasons subtract; the caller asserts the result.
// - The Note field is required: Submit stays disabled while it is empty.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

async function dismissUpdateToast(page, timeout) {
  try {
    const later = page.getByRole('button', { name: 'Later', exact: true }).first();
    await later.waitFor({ state: 'visible', timeout });
    await later.click();
    await sleep(1000);
  } catch { /* no toast — proceed */ }
}

async function createStockAdjustment(page, { product, qty, reason }) {
  await page.goto(URLS.manageStocks);
  await dismissUpdateToast(page, 5000);
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg.first()).toBeVisible({ timeout: 30000 });
  await dismissUpdateToast(page, 3000);

  const pickerBtn = dlg.first().locator('button[role="combobox"]', { hasText: 'Select a product' });
  await expect(pickerBtn).toBeVisible({ timeout: 15000 });
  await pickerBtn.click({ timeout: 15000 });
  const search = page.getByPlaceholder(/search products by name or sku/i).first();
  await expect(search).toBeVisible({ timeout: 30000 });
  await search.fill(product, { timeout: 15000 });
  await sleep(2000);
  const pick = page.getByRole('option', { name: new RegExp(product) }).first();
  await expect(pick).toBeVisible({ timeout: 30000 });
  await pick.click({ timeout: 15000 });
  await sleep(2000);
  console.log('ADJUST DIALOG AFTER PICK:', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 600));

  const qtyInput = dlg.locator('input[type="number"]').first();
  await expect(qtyInput).toBeVisible({ timeout: 30000 });
  await qtyInput.fill(String(qty));

  const reasonBtn = dlg.first().locator('button[role="combobox"]', { hasText: 'Select an option' });
  if (await reasonBtn.count()) {
    await reasonBtn.click({ timeout: 15000 });
    await sleep(800);
    const opt = page.getByRole('option', { name: reason, exact: true });
    if (await opt.count()) {
      await opt.first().click({ timeout: 15000 });
    } else {
      await dlg.locator('select').nth(1).selectOption(reason);
    }
  } else {
    await dlg.locator('select').nth(1).selectOption(reason);
  }

  const noteBox = dlg.getByPlaceholder(/why did this stock move/i);
  if (await noteBox.count()) {
    await noteBox.fill(`Test ${reason} ${qty} pcs`);
  }
  await page.getByRole('button', { name: /submit adjustment/i }).first().click({ timeout: 30000 });
  await expect(dlg).toHaveCount(0, { timeout: 30000 });
  await sleep(2000);
  console.log(`STOCK ADJUSTMENT SUBMITTED: ${product} qty ${qty}, reason ${reason}`);
}

module.exports = { createStockAdjustment };
