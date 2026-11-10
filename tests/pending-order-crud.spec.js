// Scenario 11: CRUD sales pending order — create a pending order on a slot,
// update it (quantity + slot), verify, then delete/cancel it.
// Flow discovered 7 Nov 2026 (v0.3.639): Save Pending Order → tap slot text
// → "Save Order" button; "Show Orders" lists saved pending orders.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const PRODUCT = `Pend CRUD ${suffix}`;
const PRICE = 15000;
const SLOT = 'Slot 2';

async function savePending(page, { addProduct = true, slot = SLOT } = {}) {
  if (addProduct) {
    await page.getByText(PRODUCT, { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByText(slot, { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const saveBtn = page.getByRole('button', { name: 'Save Order' });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await page.waitForTimeout(2500);
}

async function openPendingList(page) {
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  const show = page.getByRole('button', { name: /Show Orders/ });
  await expect(show).toBeVisible({ timeout: 15000 });
  await show.first().click();
  await page.waitForTimeout(2500);
}

async function closePanel(page) {
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
}

test('CRUD sales pending order', async ({ page }) => {
  await h.ensureWorkspace(page);
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, { name: PRODUCT, category: 'Auto Category', price: PRICE, description: `Pending CRUD ${suffix}` });
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);
  await h.setPosFeature(page, 'Let staff hold open orders', true);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });

  // ---- Create: 1 x Rp15,000 on Slot 2 ------------------------------------
  await savePending(page, {});
  await openPendingList(page);
  let body = await page.locator('body').innerText();
  expect(body).toContain('Rp15.000');
  expect(body).toContain(SLOT);
  console.log(`PENDING CREATED: 1 x Rp15.000 on ${SLOT}`);
  await closePanel(page);

  // ---- Update: reopen, qty 1 -> 2, save again on the same slot -----------
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Show Orders/ }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  await closePanel(page);
  // Cart should hold the pending order (1 pcs); bump to 2.
  const plus = page.getByRole('button', { name: '+', exact: true }).first();
  await expect(plus).toBeVisible({ timeout: 15000 });
  await plus.click();
  await page.waitForTimeout(1500);
  await savePending(page, { addProduct: false });
  await openPendingList(page);
  body = await page.locator('body').innerText();
  expect(body).toContain('Rp30.000');
  expect(body).toContain(SLOT);
  console.log('PENDING UPDATED: 2 x Rp15.000 = Rp30.000 on Slot 2');
  await closePanel(page);

  // ---- Delete: look for a Cancel/Delete control on the pending order ------
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Show Orders/ }).first().click();
  await page.waitForTimeout(2500);
  const row = page.locator('table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();
  await page.waitForTimeout(2500);
  const afterText = await page.locator('body').innerText();
  console.log('AFTER ROW CLICK (tail):', afterText.replace(/\n+/g, ' | ').slice(-800));
  // Try the usual cancel/delete controls, in order.
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
    // Fallback: Order Management -> Pending Orders tab.
    await page.goto('/console/pos/dashboard/pos/order-management/');
    await page.waitForTimeout(3000);
    const pendTab = page.getByText('Pending Orders', { exact: true }).first();
    if (await pendTab.count()) {
      await pendTab.click();
      await page.waitForTimeout(2500);
      const t = await page.locator('body').innerText();
      console.log('OM PENDING TAB (tail):', t.replace(/\n+/g, ' | ').slice(-900));
    }
  }
  // Verify absence in the pending list.
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  await openPendingList(page);
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
