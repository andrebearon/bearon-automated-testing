/**
 * Scenario 12 — Pending order flow: hold on a slot, move slot, checkout
 *
 * Flow:
 *   1. Create own product (Rp15,000); turn ON "Let staff hold open orders".
 *   2. Save 1 x product as a pending order on Slot 1; verify it in the list.
 *   3. Reopen it into the cart and save it on Slot 2 (without re-adding the
 *      product), then delete the original on Slot 1 — re-saving on another
 *      slot CREATES a new pending and leaves the original in place (probe
 *      12 Nov 2026), so a real move is save-copy + delete-original; verify
 *      exactly 1 pending left, on Slot 2.
 *   4. Reopen it and check out with Cash; verify the order is Paid
 *      Rp15.000 in Order Management.
 *
 * Data:    "Pend E2E <suffix>" and its order.
 * Cleanup: checked-out order voided (terminal state — the app cannot delete
 *          sales orders, verified Voided after reload) + product deleted,
 *          both best-effort.
 * Needs:   Slot 1 and Slot 2 free.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `Pend E2E ${suffix}`;
const PRICE = 15000;

test('pending order E2E: save on Slot 1, move to Slot 2, checkout', async ({ page }) => {
  await h.ensureWorkspace(page);
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, { name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE, description: `Pending E2E ${suffix}` });
  await h.setPosFeature(page, h.POS_FEATURES.holdOrders, true);

  // ---- 1. Save pending on Slot 1 (1 x Rp15,000 = Rp15,000) --------------
  await page.goto(h.URLS.till);
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });
  await h.savePendingOnSlot(page, { product: PRODUCT, slot: 'Slot 1' });
  await h.openPendingList(page, { product: PRODUCT });
  const body1 = await page.locator('body').innerText();
  expect(body1).toContain('Rp15.000');
  expect(body1).toContain('Slot 1');
  const pendRef = (body1.match(/PCEE-\d+/) || [])[0] || null;
  if (!pendRef) throw new Error('Original pending ref (PCEE-...) not found after saving on Slot 1');
  console.log(`PENDING SAVED ON SLOT 1: total Rp15.000, slot Slot 1, ref=${pendRef}`);

  // ---- 2. Reopen the pending order and move it to Slot 2 ----------------
  // The orders table is already showing: click the row to load the order into the cart.
  const row = page.locator('table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();
  await page.waitForTimeout(2500);
  const cartText = await page.locator('body').innerText();
  expect(cartText).toContain(PRODUCT);
  console.log('PENDING ORDER REOPENED INTO CART');
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  // Do NOT re-add the product, or the total doubles.
  await h.savePendingOnSlot(page, { slot: 'Slot 2' });
  await h.openPendingList(page, { product: PRODUCT });
  const body2 = await page.locator('body').innerText();
  expect(body2).toContain('Rp15.000');
  expect(body2).toContain('Slot 2');
  console.log('PENDING SAVED ON SLOT 2: total Rp15.000, slot Slot 2 (copy of the Slot 1 pending)');
  // Re-saving on another slot CREATES a new pending and leaves the original
  // on Slot 1 (probe 12 Nov 2026) — a real move is save-copy + delete-original.
  await h.deletePendingInOM(page, pendRef);
  await h.openPendingList(page, { product: PRODUCT });
  const moveRows = page.locator('table tbody tr');
  await expect(moveRows).toHaveCount(1, { timeout: 30000 });
  await expect(moveRows.first()).toContainText('Slot 2');
  console.log('MOVE VERIFIED: exactly 1 pending left, on Slot 2');
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.waitForTimeout(1500);

  // ---- 3. Checkout the pending order (cash) ------------------------------
  // The panel was closed above, so reopen the list first.
  await h.openPendingList(page, { product: PRODUCT });
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
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

  // ---- Cleanup: void this run's checked-out order, delete its product --
  // The app cannot delete sales orders; Voided is the terminal state.
  // FIX (12 Nov 2026): the Void button renders async after the details page
  // loads — the old non-waiting count() check read 0 during the load and
  // skipped the void, leaving CEE-51051 Paid. Wait for the button instead.
  await h.bestEffort(`void order ${sale.ref}`, async () => {
    await h.openOrderDetails(page, sale.ref);
    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 30000 });
    await voidBtn.click();
    await page.locator('textarea').last().fill(`Pending E2E void ${suffix}`);
    await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
    await h.sleep(2000);
    await page.reload();
    await expect(page.getByText('Voided', { exact: true }).first())
      .toBeVisible({ timeout: 30000 });
    console.log(`CLEANUP: order ${sale.ref} voided (verified after reload)`);
  });
  // Checkout does NOT consume the pending: the checked-out pending stays
  // listed as Unpaid (Balance Due Rp15.000) and its slot stays Occupied
  // (probe 12 Nov 2026: the passing run's PCEE-51002 was still on Slot 2
  // with its slot Occupied, which broke the next run's move). Delete it by
  // slot — pending refs are reused across runs, so a ref lookup is ambiguous.
  await h.bestEffort(`delete checked-out pending on Slot 2`, async () => {
    await h.deletePendingOnSlot(page, 'Slot 2');
  });
  await h.bestEffort('delete product', () => h.deleteProductByKebab(page, PRODUCT));
});
