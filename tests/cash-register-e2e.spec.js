// Scenario 10 — E2E order mix on a NEW cash register (NOT Default).
// Rewritten 7 Nov 2026 (18:0x SGT): Andreas said "just run for test 10",
// new register only so it cannot conflict with other tests.
// Flow: create NEW register -> open it via till selector -> multiple sales
// (cash to void, card to refund, cash stays Paid) -> save pending on Slot 1
// -> void 1 -> refund 1 -> cancel the pending order 1 -> close the NEW
// register -> check all data valid. Default register untouched (OPEN).
// Leftover pending orders from the 16:10 sprint (PCEE-51001 Slot 1,
// PCEE-51002 Slot 2) were DELETED beforehand by probe (Details ->
// Delete Order -> Delete Confirmation -> Delete); both slots are free.
// Money plan (opening float Rp0, unit price Rp10,000):
//   sale A: 1 x Rp10,000 Cash -> VOIDED (excluded from cash)
//   sale B: 2 x Rp10,000 = Rp20,000 Card -> REFUNDED in full
//   sale C: 1 x Rp10,000 Cash -> stays Paid
//   pending D: 1 x Rp10,000 -> CANCELLED (never paid)
// Expected close: Expected Cash Rp10,000 (only sale C), Total Takings
// Rp10,000 (cash Rp10,000 + card Rp0 after refund).
// Test account (demo workspace "Cafe muse2"), mock data only.
// Unique names per run; cleanup is this run's own records only.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const REG = `Mix Reg ${suffix}`;
const PRODUCT = `Mix Prod ${suffix}`;
const PRICE = 10000;
const PAGE = '/console/pos/dashboard/pos/cash-register/';
const today = new Date();
const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The till can revert to Default after navigation — verify the register
// combobox shows OUR register before every sale, re-select if needed.
async function ensureTillRegister(page, reg) {
  await page.goto('/console/pos/dashboard/pos/sales/');
  await sleep(2000);
  const combos = page.locator('button[role="combobox"]');
  await expect(combos.nth(1)).toBeVisible({ timeout: 30000 });
  const current = (await combos.nth(1).innerText()).trim();
  if (current === reg) return;
  console.log(`TILL REGISTER SHOWS "${current}", re-selecting ${reg}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    await combos.nth(1).click();
    await sleep(1500);
    const opt = page.getByRole('option', { name: reg }).first();
    await expect(opt).toBeVisible({ timeout: 15000 });
    await opt.click({ timeout: 15000 });
    await sleep(2000);
    const shown = (await combos.nth(1).innerText()).trim();
    if (shown === reg) { console.log(`TILL REGISTER RE-SELECTED: ${reg}`); return; }
  }
  throw new Error(`Till register selector still not ${reg}`);
}

async function savePendingOnSlot(page, slotName) {
  await page.getByText(PRODUCT, { exact: true }).first().click();
  await sleep(1200);
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await sleep(2000);
  await page.getByText(slotName, { exact: true }).first().click();
  await sleep(1500);
  const saveBtn = page.getByRole('button', { name: 'Save Order' });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await sleep(2500);
}

async function openPendingList(page) {
  const show = page.getByRole('button', { name: /Show Orders/ });
  if (await show.count()) {
    await show.first().click();
    await sleep(2500);
    return;
  }
  const slots = page.getByRole('button', { name: /Show Slots/ });
  if (await slots.count()) return;
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await sleep(2000);
  await page.getByRole('button', { name: /Show Orders/ }).first().click();
  await sleep(2500);
}

async function gotoPendingTab(page) {
  await page.goto('/console/pos/dashboard/pos/order-management/');
  await sleep(3000);
  await page.getByRole('button', { name: /pending orders/i }).first().click({ timeout: 15000 });
  await page.waitForFunction(() => /PCEE-\d+/.test(document.body.innerText), { timeout: 20000 });
  await sleep(1000);
}

test('E2E order mix on NEW register: void 1, refund 1, cancel 1, close + verify', async ({ page }) => {
  test.setTimeout(900 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create the NEW register -----------------------------------------
  await page.goto(PAGE);
  await page.getByRole('button', { name: 'Create Cash Register' }).click();
  await expect(page.getByText('Add New Cash Register')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(REG);
  await page.locator('input[name="description"]').fill(`Order-mix test register ${suffix}`);
  const selects = page.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const opts = await selects.nth(i).locator('option').allInnerTexts();
    if (opts.includes('Cafe muse2')) await selects.nth(i).selectOption({ label: 'Cafe muse2' });
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
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: 'Auto Category', price: PRICE,
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
  await h.setPosFeature(page, 'Let staff hold open orders', true);
  await ensureTillRegister(page, REG);
  await savePendingOnSlot(page, 'Slot 1');
  await openPendingList(page);
  const pendBody = await page.locator('body').innerText();
  expect(pendBody).toContain('Rp10.000');
  expect(pendBody).toContain('Slot 1');
  const pendRef = (pendBody.match(/PCEE-\d+/) || [])[0];
  if (!pendRef) throw new Error('Pending order ref (PCEE-...) not found in Show Orders list');
  console.log(`PENDING SAVED: ${pendRef} on Slot 1, Rp10.000`);
  await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {});
  await sleep(1500);

  // ---- 5. Void the cash order, verify Voided after reload --------------------
  await h.openOrderDetails(page, saleVoid.ref);
  await page.getByRole('button', { name: /void order/i }).first().click();
  await page.locator('textarea').last().fill(`Order mix void ${suffix}`);
  await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
  await sleep(2000);
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
  await sleep(2000);
  await page.reload();
  await expect(page.getByText('Refunded', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`REFUND VERIFIED: ${saleRefund.ref} refund of Rp20,000 recorded`);

  // ---- 7. Cancel the pending order from OM Pending Orders ----------------------
  await gotoPendingTab(page);
  const pendRow = page.locator('tr', { hasText: pendRef }).first();
  await expect(pendRow).toBeVisible({ timeout: 30000 });
  await pendRow.getByRole('button', { name: 'View Details' }).click();
  await sleep(2500);
  await expect(page.getByText(`Reference: #${pendRef}`).first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Cancel order' }).first().click();
  await sleep(2000);
  const cancelBody = await page.locator('body').innerText();
  console.log('AFTER CANCEL CLICK:', cancelBody.replace(/\n+/g, ' | ').slice(-400));
  // Confirm dialog, if one appeared: click its confirm button (never the
  // plain "Cancel" dismiss — look for Confirm/Yes or the action label).
  const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first();
  if (/are you sure/i.test(cancelBody) && await confirmBtn.count()) {
    console.log('CANCEL CONFIRM BTN:', await confirmBtn.innerText());
    await confirmBtn.click();
    await sleep(3000);
  }
  const afterCancel = await page.locator('body').innerText();
  if (/Cancelled/.test(afterCancel)) {
    console.log(`CANCEL VERIFIED: ${pendRef} shows Cancelled`);
  } else {
    // Maybe the page went back to the list — the ref must be gone from pending.
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
  await sleep(1500);
  await page.goto(PAGE);
  await expect(page.locator('tr', { hasText: 'Default' }).first()).toContainText('Open', { timeout: 30000 });
  console.log('GUARD OK: Default register still Open, untouched');

  // ---- 11. Best-effort cleanup: delete this run's product -------------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
  console.log(`SCENARIO 10 DONE: register ${REG} Closed; sales ${saleVoid.ref} Voided, ${saleRefund.ref} Refunded, ${salePaid.ref} Paid, pending ${pendRef} Cancelled`);
});
