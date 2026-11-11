/**
 * Scenario 07a — POS sales + Order Management (update, void, refund)
 *
 * Flow:
 *   1. Create own product (Rp15,000).
 *   2. Cash sale (exact amount) -> OM row + details match product, qty,
 *      price, total, method, Paid.
 *   3. Add a note via Update Status, reload, verify it persisted.
 *   4. Variation: 2 x product, Take Away, checkout note, Card payment ->
 *      verify 2 x Rp15,000 = Rp30,000, Card, type and note.
 *   5. Void the cash order -> Voided after reload.
 *   6. Refund the card order in full -> Refunded after reload.
 *
 * Data:    "Sales Prod <suffix>" and its two orders.
 * Cleanup: orders are voided / refunded by the test; product deleted
 *          best-effort (the UI may refuse products that have orders).
 * Notes:   OM list renders the payment method lowercase ("cash"), details
 *          page capitalised — match case-insensitively.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const CATEGORY = h.AUTO_CATEGORY;
const PRODUCT = `Sales Prod ${suffix}`;
const PRICE = 15000;
const NOTE1 = `OM note ${suffix}`;
const NOTE2 = `Sales variation ${suffix}`;
const VOID_REASON = `Auto test void ${suffix}`;
const REFUND_REASON = `Auto test refund ${suffix}`;

test('sales + order management: cash sale, update, card sale, void, refund', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 0. Own product for this run (shared category reused) --------------
  await h.ensureCategory(page, CATEGORY);
  await page.goto(h.URLS.products);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await h.fillProductGeneral(page, {
    name: PRODUCT, category: CATEGORY, price: PRICE,
    description: `Sales flow test product ${suffix}`,
  });
  await h.saveProductForm(page);
  if (!(await h.findProductInList(page, PRODUCT))) {
    throw new Error(`Product not listed after create: ${PRODUCT}`);
  }
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);

  // ---- 1. Cash sale, exact amount ----------------------------------------
  await h.openRegisterIfNeeded(page);
  const sale1 = await h.completeTillSale(page, {
    product: PRODUCT, qty: 1, price: PRICE, payment: 'Cash',
  });
  const ref1 = sale1.ref;

  // ---- 2. Order Management: row + details match the sale -----------------
  await h.findOrderInOM(page, ref1);
  const row1 = page.locator('tr', { hasText: ref1 }).first();
  await expect(row1).toContainText(/cash/i);
  await expect(row1).toContainText(/paid/i);
  await expect(row1).toContainText(/15[.,]?000/);
  await h.openOrderDetails(page, ref1);
  const details1 = await page.locator('body').innerText();
  expect(details1).toContain(PRODUCT);
  expect(details1).toMatch(/1 Pcs x Rp15[.,]?000/);
  expect(details1).toMatch(/Total\s*Rp15[.,]?000/);
  expect(details1).toMatch(/Paid/i);
  expect(details1).toMatch(/Cash/i);
  console.log(`OM VERIFIED: ${ref1} — ${PRODUCT} x1 @ Rp${PRICE}, Cash, Paid`);

  // ---- 3. Update action: add a note, verify it persists after reload -----
  await page.getByRole('button', { name: /update status/i }).first().click();
  await page.locator('textarea').last().fill(NOTE1);
  await page.getByRole('button', { name: 'Update Status', exact: true }).last().click();
  await h.sleep(2000);
  await page.reload();
  await expect(page.getByText(NOTE1).first()).toBeVisible({ timeout: 30000 });
  console.log(`NOTE VERIFIED: "${NOTE1}" on ${ref1} after reload`);

  // ---- 4. Variation: 2 x product, note, Take Away, Card ------------------
  const sale2 = await h.completeTillSale(page, {
    product: PRODUCT, qty: 2, price: PRICE, payment: 'Card',
    note: NOTE2, orderType: 'Take Away',
  });
  const ref2 = sale2.ref;
  await h.findOrderInOM(page, ref2);
  const row2 = page.locator('tr', { hasText: ref2 }).first();
  await expect(row2).toContainText(/card/i);
  await expect(row2).toContainText(/paid/i);
  await expect(row2).toContainText(/30[.,]?000/); // 2 x Rp15,000
  await h.openOrderDetails(page, ref2);
  const details2 = await page.locator('body').innerText();
  expect(details2).toContain(PRODUCT);
  expect(details2).toMatch(/2 Pcs x Rp15[.,]?000/);
  expect(details2).toMatch(/Total\s*Rp30[.,]?000/);
  expect(details2).toMatch(/Card/i);
  expect(details2).toContain(NOTE2);
  expect(details2).toContain(sale2.typeUsed);
  console.log(`VARIATION VERIFIED: ${ref2} — ${PRODUCT} x2 = Rp30,000, Card, ${sale2.typeUsed}, note saved`);

  // ---- 5. Void the cash order (own only), verify Voided after reload -----
  await h.openOrderDetails(page, ref1);
  await page.getByRole('button', { name: /void order/i }).first().click();
  await page.locator('textarea').last().fill(VOID_REASON);
  await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
  await h.sleep(2000);
  await page.reload();
  await expect(page.getByText('Voided', { exact: true }).first())
    .toBeVisible({ timeout: 30000 });
  console.log(`VOID VERIFIED: ${ref1} is Voided after reload`);

  // ---- 6. Refund the card order (own only), verify it recorded -----------
  await h.openOrderDetails(page, ref2);
  await page.getByRole('button', { name: /refund order/i }).first().click();
  // The dialog's only text input is the refund amount.
  const amountInput = page.locator('[role="dialog"] input[type="text"]').first();
  if (await amountInput.count()) {
    await amountInput.fill(String(PRICE * 2));
  } else {
    await page.locator('input[type="text"]').last().fill(String(PRICE * 2));
  }
  await page.locator('textarea').last().fill(REFUND_REASON);
  await page.getByRole('button', { name: /record refund/i }).click();
  await expect(page.getByRole('button', { name: /record refund/i }))
    .toHaveCount(0, { timeout: 30000 });
  await h.sleep(2000);
  await page.reload();
  // Wait for the status to render before reading the body (details re-fetch after reload).
  await expect(page.getByText('Refunded', { exact: true }).first())
    .toBeVisible({ timeout: 30000 });
  const afterRefund = await page.locator('body').innerText();
  const refundShown = /Refunded/i.test(afterRefund)
    || /Refund.*Rp30[.,]?000/i.test(afterRefund)
    || /Refund Amount/i.test(afterRefund);
  expect(refundShown).toBeTruthy();
  console.log(`REFUND VERIFIED: ${ref2} refund of Rp${PRICE * 2} recorded (${/Refunded/i.test(afterRefund) ? 'status Refunded' : 'refund line shown'})`);

  // ---- 7. Best-effort cleanup: delete this run's product ------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await page.goto(h.URLS.products);
    const search = page.getByPlaceholder(/search products/i).first();
    await search.fill(PRODUCT);
    await h.sleep(1500);
    const row = page.locator('tr', { hasText: PRODUCT }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button').filter({ hasNotText: /.+/ }).first().click();
    await h.sleep(1200);
    const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
    if (await menuDelete.count()) await menuDelete.click();
    else await page.getByText('Delete', { exact: true }).last().click();
    await h.sleep(1500);
    const confirmDelete = page.getByRole('button', { name: /^delete$/i }).first();
    if (await confirmDelete.count()) await confirmDelete.click();
    await expect(page.getByText(PRODUCT, { exact: true })).toHaveCount(0, { timeout: 30000 });
  });
});
