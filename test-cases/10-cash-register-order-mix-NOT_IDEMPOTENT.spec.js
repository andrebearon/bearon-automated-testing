/**
 * Scenario 10 — Order mix on a NEW cash register, then close and reconcile
 *
 * Flow:
 *   1. Create a NEW register (never Default) and open a session on it.
 *   2. Create own product (Rp10,000) and make three sales on that register:
 *        A: 1 x Cash  -> will be VOIDED
 *        B: 2 x Card  -> will be REFUNDED in full (Rp20,000)
 *        C: 1 x Cash  -> stays Paid
 *   3. Save a pending order D (1 x Rp10,000) on Slot 1.
 *   4. Void A, refund B, cancel D (OM > Pending Orders); verify each after reload.
 *   5. Verify C is still Paid.
 *   6. Close the register: Expected Cash must be Rp10,000 (only C).
 *   7. Verify today's session in All Logs; guard Default register still Open.
 *
 * Data:    "Mix Reg <suffix>", "Mix Prod <suffix>", orders A-D.
 * Cleanup: product deleted best-effort; register stays (no Delete control,
 *          Closed is the terminal state). Orders end in terminal states by
 *          design: A voided, B refunded, C stays Paid, pending D cancelled.
 * Needs:   Slot 1 free (no leftover pending order on it). The test turns ON
 *          "Let staff hold open orders".
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const REG = `Mix Reg ${suffix}`;
const PRODUCT = `Mix Prod ${suffix}`;
const PRICE = 10000;
const todayStr = h.todayDdMmYyyy();

// The till can revert to Default after navigation; re-select OUR register before every sale.
// The selector shows "<name> (Counter)" — compare the name before the trailing parenthetical.
async function ensureTillRegister(page, reg) {
  await page.goto(h.URLS.till);
  await h.sleep(2000);
  const combos = page.locator('button[role="combobox"]');
  await expect(combos.nth(1)).toBeVisible({ timeout: 30000 });
  const shownName = (s) => s.replace(/\s*\([^)]*\)\s*$/, '');
  const current = (await combos.nth(1).innerText()).trim();
  if (shownName(current) === reg) return;
  console.log(`TILL REGISTER SHOWS "${current}", re-selecting ${reg}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    await h.clearBlockingOverlay(page, 'till register re-select');
    await combos.nth(1).click({ timeout: 10000 });
    await h.sleep(1500);
    const opt = page.getByRole('option', { name: reg }).first();
    await expect(opt).toBeVisible({ timeout: 15000 });
    await opt.click({ timeout: 15000 });
    await h.sleep(2000);
    const shown = (await combos.nth(1).innerText()).trim();
    if (shownName(shown) === reg) { console.log(`TILL REGISTER RE-SELECTED: ${reg} (shown as "${shown}")`); return; }
  }
  throw new Error(`Till register selector still not ${reg}`);
}

async function gotoPendingTab(page) {
  await page.goto(h.URLS.orderManagement);
  await h.sleep(3000);
  await page.getByRole('button', { name: /pending orders/i }).first().click({ timeout: 15000 });
  await page.waitForFunction(() => /PCEE-\d+/.test(document.body.innerText), { timeout: 20000 });
  await h.sleep(1000);
}

test('E2E order mix on NEW register: void 1, refund 1, cancel 1, close + verify', async ({ page }) => {
  test.setTimeout(900 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create the NEW register -----------------------------------------
  await page.goto(h.URLS.cashRegisters);
  await page.getByRole('button', { name: 'Create Cash Register' }).click();
  await expect(page.getByText('Add New Cash Register')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(REG);
  await page.locator('input[name="description"]').fill(`Order-mix test register ${suffix}`);
  const selects = page.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const opts = await selects.nth(i).locator('option').allInnerTexts();
    if (opts.includes(h.WORKSPACE)) await selects.nth(i).selectOption({ label: h.WORKSPACE });
  }
  const addBtn = page.getByRole('button', { name: 'Add Cash Register' });
  await expect(addBtn).toBeEnabled({ timeout: 10000 });
  await addBtn.click({ timeout: 30000 });
  const row = page.locator('tr', { hasText: REG });
  await expect(row.first()).toBeVisible({ timeout: 30000 });
  await expect(row.first()).toContainText('Closed');
  console.log(`REGISTER CREATED: ${REG} (Closed)`);

  // ---- 2. Open a session on OUR register -----------------------------------
  await h.openRegisterSession(page, REG);
  console.log(`REGISTER SESSION OPENED: ${REG}`);

  // ---- 3. Own product + three sales on OUR register -------------------------
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE,
    description: `Order-mix test product ${suffix}`,
  });
  await ensureTillRegister(page, REG);
  const saleVoid = await h.completeTillSale(page, { product: PRODUCT, qty: 1, price: PRICE, payment: 'Cash' });
  await ensureTillRegister(page, REG);
  const saleRefund = await h.completeTillSale(page, { product: PRODUCT, qty: 2, price: PRICE, payment: 'Card' });
  await ensureTillRegister(page, REG);
  const salePaid = await h.completeTillSale(page, { product: PRODUCT, qty: 1, price: PRICE, payment: 'Cash' });
  console.log(`SALES: void-target ${saleVoid.ref} (1x Cash Rp10,000), refund-target ${saleRefund.ref} (2x Card Rp20,000), stays-paid ${salePaid.ref} (1x Cash Rp10,000)`);

  // ---- 4. Save a pending order on Slot 1 (1 x Rp10,000) ---------------------
  // Verified via OM, not the till panel: after Save Order the app shows an
  // "Order Saved Successfully" dialog, and once it is closed the till panel
  // cannot be reopened from an empty cart ("Save Pending Order" is disabled
  // with no items, and there is no other entry point to the list) — see
  // utils/till.js openPendingList. OM lists the same pending with its ref.
  await h.setPosFeature(page, h.POS_FEATURES.holdOrders, true);
  await ensureTillRegister(page, REG);
  await h.savePendingOnSlot(page, { product: PRODUCT, slot: 'Slot 1' });
  await gotoPendingTab(page);
  const pendBody = await page.locator('body').innerText();
  expect(pendBody).toContain('Rp10.000');
  expect(pendBody).toContain('Slot 1');
  const pendRef = (pendBody.match(/PCEE-\d+/) || [])[0];
  if (!pendRef) throw new Error('Pending order ref (PCEE-...) not found in OM Pending Orders list');
  console.log(`PENDING SAVED: ${pendRef} on Slot 1, Rp10.000`);

  // ---- 5. Void the cash order, verify Voided after reload --------------------
  await h.openOrderDetails(page, saleVoid.ref);
  await page.getByRole('button', { name: /void order/i }).first().click();
  await page.locator('textarea').last().fill(`Order mix void ${suffix}`);
  await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
  await h.sleep(2000);
  await page.reload();
  await expect(page.getByText('Voided', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`VOID VERIFIED: ${saleVoid.ref} is Voided after reload (Rp10,000 cash excluded)`);

  // ---- 6. Refund the card order in full, verify Refunded after reload ---------
  await h.openOrderDetails(page, saleRefund.ref);
  await page.getByRole('button', { name: /refund order/i }).first().click();
  const amountInput = page.locator('[role="dialog"] input[type="text"]').first();
  if (await amountInput.count()) {
    await amountInput.fill(String(PRICE * 2));
  } else {
    await page.locator('input[type="text"]').last().fill(String(PRICE * 2));
  }
  await page.locator('textarea').last().fill(`Order mix refund ${suffix}`);
  await page.getByRole('button', { name: /record refund/i }).click();
  await expect(page.getByRole('button', { name: /record refund/i })).toHaveCount(0, { timeout: 30000 });
  await h.sleep(2000);
  await page.reload();
  await expect(page.getByText('Refunded', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`REFUND VERIFIED: ${saleRefund.ref} refund of Rp20,000 recorded`);

  // ---- 7. Cancel the pending order from OM Pending Orders ----------------------
  await gotoPendingTab(page);
  const pendRow = page.locator('tr', { hasText: pendRef }).first();
  await expect(pendRow).toBeVisible({ timeout: 30000 });
  await pendRow.getByRole('button', { name: 'View Details' }).click();
  await h.sleep(2500);
  await expect(page.getByText(`Reference: #${pendRef}`).first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Cancel order' }).first().click();
  await h.sleep(2000);
  const cancelBody = await page.locator('body').innerText();
  console.log('AFTER CANCEL CLICK:', cancelBody.replace(/\n+/g, ' | ').slice(-400));
  // FIX (11 Nov 2026, test 10 run 4): the confirm dialog is "Cancel this
  // order? ..." with Keep order / Cancel order / Close. Its confirm button is
  // literally "Cancel order" — the old /confirm|yes/i matcher never matched
  // it, so the cancel was never confirmed and the order stayed listed. Scope
  // the confirm click to the dialog so the first "Cancel order" (which opened
  // the dialog) is never re-clicked.
  const cancelDlg = page.locator('[role="dialog"]', { hasText: 'Cancel this order?' }).first();
  if (await cancelDlg.count()) {
    console.log('CANCEL CONFIRM DIALOG present — clicking its Cancel order button');
    await cancelDlg.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await h.sleep(3000);
  }
  const afterCancel = await page.locator('body').innerText();
  if (/Cancelled/.test(afterCancel)) {
    console.log(`CANCEL VERIFIED: ${pendRef} shows Cancelled`);
  } else {
    await gotoPendingTab(page);
    await expect(page.getByText(pendRef)).toHaveCount(0, { timeout: 30000 });
    console.log(`CANCEL VERIFIED: ${pendRef} no longer in Pending Orders list`);
  }

  // ---- 8. Paid control still Paid ----------------------------------------------
  await h.openOrderDetails(page, salePaid.ref);
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`PAID CONTROL VERIFIED: ${salePaid.ref} still Paid (Rp10,000)`);

  // ---- 9. Close OUR register, verify money ---------------------------------------
  const fin = await h.closeRegisterSession(page, REG);
  const panel = fin.panelText;
  const cashSales = (panel.match(/Cash Sales\s*Rp([\d.,]+)/) || [])[1];
  const cardSales = (panel.match(/Card\s*Rp([\d.,]+)/) || [])[1];
  const totalTakings = (panel.match(/Total Takings\s*Rp([\d.,]+)/) || [])[1];
  console.log(`CLOSE PANEL ${REG}: Expected Rp${fin.expectedCash}, Cash Sales Rp${cashSales}, Card Rp${cardSales}, Total Takings Rp${totalTakings}`);
  expect(fin.expectedCash).toBe(PRICE);
  console.log(`FINAL CLOSE VERIFIED: Expected Cash Rp${fin.expectedCash} = Rp10,000 (only the stays-paid cash sale; voided cash + refunded card excluded)`);

  // ---- 10. All Logs for OUR register + Default guard ------------------------------
  await page.locator('tr', { hasText: REG }).first().getByRole('button', { name: 'All Logs' }).click();
  await expect(page.getByText('Cash Register Logs').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(todayStr).first()).toBeVisible({ timeout: 30000 });
  const logsText = await page.locator('body').innerText();
  expect(logsText).toContain(todayStr);
  console.log(`REGISTER LOGS READ: ${REG} session ${todayStr} present in All Logs`);
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await h.sleep(1500);
  await page.goto(h.URLS.cashRegisters);
  await expect(page.locator('tr', { hasText: 'Default' }).first()).toContainText('Open', { timeout: 30000 });
  console.log('GUARD OK: Default register still Open, untouched');

  // ---- 11. Best-effort cleanup: delete this run's product -------------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
  console.log(`SCENARIO 10 DONE: register ${REG} Closed; sales ${saleVoid.ref} Voided, ${saleRefund.ref} Refunded, ${salePaid.ref} Paid, pending ${pendRef} Cancelled`);
});
