// Till (POS sales screen) helpers: complete a sale and save / list pending orders.
// UI facts (probe-verified, v0.3.639):
// - The checkout view renders async: wait for "Order Summary" before touching
//   order type or notes, or the fills are silently skipped.
// - Card payment completes with "Confirm Order" only (no card details).
// - The receipt ref is LETTERS-digits (e.g. CEE-51004) and renders async.
// - Pending orders need the POS feature "Let staff hold open orders" ON.
//   "Save Pending Order" opens a panel with slots ("Slot 1", "Slot 2") as
//   clickable TEXT; picking one shows "Save Order". The panel's "Show Orders" /
//   "Show Slots" toggle switches between the slots and the saved orders table.
//   After Save Order the panel stays open.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

// Sell the run's own product. payment: 'Cash' (exact amount) or 'Card'. Returns { ref, typeUsed }.
async function completeTillSale(page, { product, qty = 1, price, payment = 'Cash', note = '', orderType = null }) {
  await page.goto(URLS.till);
  for (let i = 0; i < qty; i++) {
    await page.getByText(product).first().click();
    await sleep(800);
  }
  if (qty > 1) {
    await expect(page.getByText(new RegExp(`${qty} pcs`, 'i')).first())
      .toBeVisible({ timeout: 15000 });
  }
  await page.getByRole('button', { name: /checkout/i }).first().click();
  await expect(page.getByText('Order Summary').first())
    .toBeVisible({ timeout: 30000 });
  let typeUsed = 'Dine In';
  if (orderType) {
    const typeBtn = page.locator('button', { hasText: 'Dine In' }).first();
    await typeBtn.click({ timeout: 30000 });
    const opt = page.getByRole('option', { name: orderType }).first();
    await expect(opt).toBeVisible({ timeout: 30000 });
    await opt.click();
    await expect(page.locator('button', { hasText: orderType }).first())
      .toBeVisible({ timeout: 30000 });
    typeUsed = orderType;
  }
  if (note) {
    const noteInput = page.getByPlaceholder(/add any notes/i).first();
    await expect(noteInput).toBeVisible({ timeout: 30000 });
    await noteInput.fill(note);
    await expect(noteInput).toHaveValue(note, { timeout: 10000 });
  }
  await page.getByText(payment, { exact: true }).first().click();
  if (payment === 'Cash') {
    const exact = page.getByRole('button', { name: /Exact amount/i });
    if (await exact.count()) {
      await exact.first().click();
    } else {
      await page.locator('input').first().fill(String(price * qty));
    }
  }
  await page.getByRole('button', { name: /Confirm Order|Confirm|Pay|Complete/i }).first().click();
  await expect(page.getByRole('button', { name: /New sale/i })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(
    () => /[A-Z]{2,4}-\d+/.test(document.body.innerText),
    { timeout: 30000 },
  );
  const receiptBody = await page.locator('body').innerText();
  const refMatch = receiptBody.match(/[A-Z]{2,4}-\d+/);
  if (!refMatch) throw new Error('No order reference found on the completed receipt');
  const ref = refMatch[0];
  console.log(`SALE COMPLETED: ${ref} (${product} x${qty} @ Rp${price}, ${payment}, ${typeUsed})`);
  const newSale = page.getByRole('button', { name: /New sale/i }).first();
  if (await newSale.count()) await newSale.click().catch(() => {});
  return { ref, typeUsed };
}

// Save the cart as a pending order on a slot. Pass product to add 1 x it first, or null to save the cart as is.
async function savePendingOnSlot(page, { product = null, slot }) {
  if (product) {
    await page.getByText(product, { exact: true }).first().click();
    await sleep(1200);
  }
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await sleep(2000);
  await page.getByText(slot, { exact: true }).first().click();
  await sleep(1500);
  const saveBtn = page.getByRole('button', { name: 'Save Order' });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await sleep(2500);
}

// Show the saved pending orders table, whether the panel is closed, on slots, or already on orders.
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

module.exports = { completeTillSale, savePendingOnSlot, openPendingList };
