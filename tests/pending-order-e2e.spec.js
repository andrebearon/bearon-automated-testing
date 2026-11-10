// Scenario 12: pending order E2E — create pending on Slot 1, verify it in
// the Pending Orders list, move it to Slot 2, checkout, verify Paid in OM.
// Discovered 7 Nov 2026 (v0.3.639): Save Pending Order opens a panel with
// "Floor 1 | Slot 1 | Slot 2" as clickable TEXT (not buttons); tapping a
// slot shows "Confirmation | Selected Slot | Slot 1 | Save Order". The
// "Show Orders" toggle lists saved pending orders (Order No. / Total /
// Slot / Source / Reserved dates). Hold-orders feature must be ON.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const PRODUCT = `Pend E2E ${suffix}`;
const PRICE = 15000;

async function openTill(page) {
  await page.goto('/console/pos/dashboard/pos/sales/');
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });
}

async function savePendingOnSlot(page, slotName, addProduct = true) {
  if (addProduct) {
    await page.getByText(PRODUCT, { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByText(slotName, { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const saveBtn = page.getByRole('button', { name: 'Save Order' });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await page.waitForTimeout(2500);
}

// FIX (run 2): after Save Order the Pending Orders dialog STAYS OPEN, so
// re-clicking "Save Pending Order" waits on a disabled button (empty cart).
// The dialog may already show the orders table ("Show Slots" toggle) or
// the slots view ("Show Orders" toggle) — handle both, only opening the
// panel from the till when neither is present.
async function openPendingList(page) {
  const show = page.getByRole('button', { name: /Show Orders/ });
  if (await show.count()) {
    await show.first().click();
    await page.waitForTimeout(2500);
    return;
  }
  const slots = page.getByRole('button', { name: /Show Slots/ });
  if (await slots.count()) return; // orders table already showing
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Show Orders/ }).first().click();
  await page.waitForTimeout(2500);
}

test('pending order E2E: save on Slot 1, move to Slot 2, checkout', async ({ page }) => {
  await h.ensureWorkspace(page);
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, { name: PRODUCT, category: 'Auto Category', price: PRICE, description: `Pending E2E ${suffix}` });
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);
  await h.setPosFeature(page, 'Let staff hold open orders', true);

  // ---- 1. Save pending on Slot 1 (1 x Rp15,000 = Rp15,000) --------------
  await openTill(page);
  await savePendingOnSlot(page, 'Slot 1');
  // Verify in the Pending Orders list.
  await openPendingList(page);
  const body1 = await page.locator('body').innerText();
  expect(body1).toContain('Rp15.000');
  expect(body1).toContain('Slot 1');
  const refMatch = body1.match(/PO-\d+|PEND-\d+|[A-Z]{2,4}-\d+/);
  console.log(`PENDING SAVED ON SLOT 1: total Rp15.000, slot Slot 1, ref=${refMatch ? refMatch[0] : 'n/a'}`);

  // ---- 2. Reopen the pending order and move it to Slot 2 ----------------
  // Stay in the dialog (table already showing): click the row to load
  // the order back into the cart.
  const row = page.locator('table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();
  await page.waitForTimeout(2500);
  const cartText = await page.locator('body').innerText();
  expect(cartText).toContain(PRODUCT);
  console.log('PENDING ORDER REOPENED INTO CART');
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  // Move to Slot 2 via Save Pending again (cart already holds the order —
  // do NOT re-add the product, or the total doubles).
  await savePendingOnSlot(page, 'Slot 2', false);
  await openPendingList(page);
  const body2 = await page.locator('body').innerText();
  expect(body2).toContain('Rp15.000');
  expect(body2).toContain('Slot 2');
  console.log('PENDING MOVED TO SLOT 2: total Rp15.000, slot Slot 2');
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.waitForTimeout(1500);

  // ---- 3. Checkout the pending order (cash) ------------------------------
  // Dialog still open on the table: click the row once more to load it.
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  // Checkout the loaded cart directly (do NOT re-add the product).
  await page.getByRole('button', { name: /checkout/i }).first().click();
  await expect(page.getByText('Order Summary').first()).toBeVisible({ timeout: 30000 });
  await page.getByText('Cash', { exact: true }).first().click();
  const exact = page.getByRole('button', { name: /Exact amount/i });
  if (await exact.count()) await exact.first().click();
  await page.getByRole('button', { name: /Confirm Order|Confirm|Pay|Complete/i }).first().click();
  await expect(page.getByRole('button', { name: /New sale/i })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => /[A-Z]{2,4}-\d+/.test(document.body.innerText), { timeout: 30000 });
  const receiptBody = await page.locator('body').innerText();
  const sale = { ref: receiptBody.match(/[A-Z]{2,4}-\d+/)[0] };
  console.log(`CHECKOUT COMPLETED: ${sale.ref} Rp${PRICE} Cash`);
  await h.findOrderInOM(page, sale.ref);
  await h.openOrderDetails(page, sale.ref);
  const det = await page.locator('body').innerText();
  expect(det).toContain('Paid');
  expect(det).toContain('Rp15.000');
  console.log(`OM VERIFIED: ${sale.ref} Paid, Rp15.000`);

  // ---- Cleanup: delete own product ---------------------------------------
  await h.bestEffort('delete product', () => h.deleteProductByKebab(page, PRODUCT));
});
