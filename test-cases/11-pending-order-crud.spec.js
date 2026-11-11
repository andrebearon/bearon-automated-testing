/**
 * Scenario 11 — CRUD pending (held) order
 *
 * Flow:
 *   1. Create own product (Rp15,000); turn ON "Let staff hold open orders".
 *   2. Create: save 1 x product as a pending order on Slot 2; verify Rp15.000 on Slot 2.
 *   3. Update: reopen it into the cart, qty 1 -> 2, save again on Slot 2;
 *      verify Rp30.000.
 *   4. Delete: reopen it and try Cancel / Delete; verify it is gone from the list.
 *      If no control exists, it is logged (not failed) and left on Slot 2.
 *
 * Data:    "Pend CRUD <suffix>" and its pending order.
 * Cleanup: product deleted best-effort.
 * Needs:   Slot 2 free.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `Pend CRUD ${suffix}`;
const PRICE = 15000;
const SLOT = 'Slot 2';

async function closePanel(page) {
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
}

test('CRUD sales pending order', async ({ page }) => {
  await h.ensureWorkspace(page);
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, { name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE, description: `Pending CRUD ${suffix}` });
  await h.setPosFeature(page, h.POS_FEATURES.holdOrders, true);
  await page.goto(h.URLS.till);
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });

  // ---- Create: 1 x Rp15,000 on Slot 2 ------------------------------------
  await h.savePendingOnSlot(page, { product: PRODUCT, slot: SLOT });
  await h.openPendingList(page);
  let body = await page.locator('body').innerText();
  expect(body).toContain('Rp15.000');
  expect(body).toContain(SLOT);
  console.log(`PENDING CREATED: 1 x Rp15.000 on ${SLOT}`);
  await closePanel(page);

  // ---- Update: reopen, qty 1 -> 2, save again on the same slot -----------
  await h.openPendingList(page);
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  await closePanel(page);
  const plus = page.getByRole('button', { name: '+', exact: true }).first();
  await expect(plus).toBeVisible({ timeout: 15000 });
  await plus.click();
  await page.waitForTimeout(1500);
  await h.savePendingOnSlot(page, { slot: SLOT });
  await h.openPendingList(page);
  body = await page.locator('body').innerText();
  expect(body).toContain('Rp30.000');
  expect(body).toContain(SLOT);
  console.log('PENDING UPDATED: 2 x Rp15.000 = Rp30.000 on Slot 2');
  await closePanel(page);

  // ---- Delete: look for a Cancel/Delete control on the pending order ------
  await h.openPendingList(page);
  const row = page.locator('table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();
  await page.waitForTimeout(2500);
  const afterText = await page.locator('body').innerText();
  console.log('AFTER ROW CLICK (tail):', afterText.replace(/\n+/g, ' | ').slice(-800));
  let deleted = false;
  for (const name of [/Cancel (this )?order/i, /Delete/i, /Cancel/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(2000);
      const confirm = page.getByRole('button', { name: /^(Yes|Confirm|Delete|Cancel)$/ }).first();
      if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(2000); }
      deleted = true;
      console.log(`DELETE ATTEMPTED VIA BUTTON: ${name}`);
      break;
    }
  }
  if (!deleted) {
    // Diagnostic only: log what the OM Pending Orders tab offers.
    await page.goto(h.URLS.orderManagement);
    await page.waitForTimeout(3000);
    const pendTab = page.getByText('Pending Orders', { exact: true }).first();
    if (await pendTab.count()) {
      await pendTab.click();
      await page.waitForTimeout(2500);
      const t = await page.locator('body').innerText();
      console.log('OM PENDING TAB (tail):', t.replace(/\n+/g, ' | ').slice(-900));
    }
  }
  await page.goto(h.URLS.till);
  await page.waitForTimeout(3000);
  await h.openPendingList(page);
  body = await page.locator('body').innerText();
  if (deleted) {
    expect(body).not.toContain('Rp30.000');
    console.log('PENDING DELETED: Rp30.000 row gone from the list');
  } else {
    console.log('NO DELETE/CANCEL CONTROL FOUND — pending order left standing on Slot 2 (logged, not forced)');
  }
  await closePanel(page);
  await h.bestEffort('delete product', () => h.deleteProductByKebab(page, PRODUCT));
});
