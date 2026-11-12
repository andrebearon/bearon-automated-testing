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
//   After Save Order the app shows an "Order Saved Successfully" dialog on top
//   of the panel (panel becomes aria-hidden) — it MUST be closed before the
//   panel is usable again. FIX (11 Nov 2026, test 10 re-run): openPendingList
//   used to fall through to clicking "Save Pending Order", which is DISABLED
//   once the cart is empty, so the click waited until the 900s test timeout
//   with no error. The dialog is now dismissed in savePendingOnSlot and at
//   the start of openPendingList, and the fallback throws instead of hanging.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

// Sell the run's own product. payment: 'Cash' (exact amount) or 'Card'. Returns { ref, typeUsed }.
// customer: optional customer name — selected at checkout via the "Select a
// customer" picker (probe-verified 12 Nov 2026).
async function completeTillSale(page, { product, qty = 1, price, payment = 'Cash', note = '', orderType = null, customer = null }) {
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
  if (customer) {
    // Checkout has a "Customer" section with a "Select a customer" button
    // (probe-verified 12 Nov 2026, v0.3.659). The picker is a dialog with a
    // search box and a table; pick the row by name. The cart itself has no
    // customer control.
    await page.getByRole('button', { name: 'Select a customer' }).first().click();
    const picker = page.locator('[role="dialog"]', { hasText: 'Select a Customer' }).first();
    await expect(picker).toBeVisible({ timeout: 15000 });
    await picker.getByPlaceholder(/search/i).first().fill(customer);
    await sleep(2000);
    await picker.getByText(customer).first().click();
    await sleep(1500);
    await expect(page.getByText(customer).first()).toBeVisible({ timeout: 15000 });
    console.log(`CUSTOMER SELECTED AT CHECKOUT: ${customer}`);
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

// Dismiss the "Order Saved Successfully" dialog if it is open, so the
// pending panel underneath becomes usable again. No-op when absent.
async function dismissSavedDialog(page) {
  const dlg = page.locator('[role="dialog"]', { hasText: 'Order Saved Successfully' }).first();
  try {
    await dlg.waitFor({ state: 'visible', timeout: 3000 });
  } catch { return; } // No dialog — proceed.
  console.log('SAVED DIALOG present — closing it');
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click({ timeout: 10000 });
  await sleep(1500);
}

// Save the cart as a pending order on a slot. Pass product to add 1 x it first, or null to save the cart as is.
async function savePendingOnSlot(page, { product = null, slot }) {
  if (product) {
    await page.getByText(product, { exact: true }).first().click();
    await sleep(1200);
  }
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await sleep(2000);
  // The panel remembers its last view: if it opened on the orders list,
  // switch to the slots view before picking a slot — otherwise the slot
  // text matched is the table cell in the orders list and no "Save Order"
  // button ever appears (spec 11 update step, 12 Nov 2026).
  const showSlots = page.getByRole('button', { name: /Show Slots/ }).first();
  if (await showSlots.count()) {
    await showSlots.click();
    await sleep(1500);
  }
  const slotEl = page.getByText(slot, { exact: true }).first();
  // Bound the wait: an occupied slot's label is "Slot N (Occupied)", so the
  // exact match never resolves and an unguarded click waits until the test
  // timeout (spec 11 run 3 burned 5.3m here). Fail fast instead.
  await expect(slotEl).toBeVisible({ timeout: 15000 });
  await slotEl.click();
  await sleep(1500);
  const saveBtn = page.getByRole('button', { name: 'Save Order' });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await sleep(2500);
  await dismissSavedDialog(page);
}

// Show the saved pending orders table, whether the panel is closed, on slots, or already on orders.
// With an empty cart the panel cannot be opened at all ("Save Pending Order"
// is disabled) — pass { product } and the item is added to the cart first so
// the button enables. Reopening a pending REPLACES the cart (probe-verified
// 12 Nov 2026: added 1x Mix Prod to open the panel, clicked the pending row,
// cart showed 1 pcs, not 2), so the added item does not contaminate the
// reopened order. Without a product and with an empty cart, fail fast.
async function openPendingList(page, { product = null } = {}) {
  await dismissSavedDialog(page);
  const show = page.getByRole('button', { name: /Show Orders/ });
  if (await show.count()) {
    await show.first().click();
    await sleep(2500);
    return;
  }
  const slots = page.getByRole('button', { name: /Show Slots/ });
  if (await slots.count()) return; // Already on the orders list.
  const savePendingBtn = page.getByRole('button', { name: 'Save Pending Order' }).first();
  if (!(await savePendingBtn.count()) || (await savePendingBtn.isDisabled())) {
    if (!product) {
      throw new Error('openPendingList: no Show Orders / Show Slots toggle and Save Pending Order is missing or disabled (empty cart?) — pass { product } so an item can be added to open the panel');
    }
    console.log(`OPEN PENDING LIST: cart empty, adding ${product} to open the panel`);
    await page.getByText(product, { exact: true }).first().click();
    await sleep(1200);
  }
  await savePendingBtn.click();
  await sleep(2000);
  const showAfter = page.getByRole('button', { name: /Show Orders/ });
  if (await showAfter.count()) {
    await showAfter.first().click();
    await sleep(2500);
    return;
  }
  if (await page.getByRole('button', { name: /Show Slots/ }).count()) return;
  throw new Error('openPendingList: panel opened but neither Show Orders nor Show Slots appeared');
}

// Delete a pending order via OM > Pending Orders > Details (proven path).
// Runs in a SEPARATE tab so the till page (and its cart) is never navigated:
// the reopened cart does not survive a navigation away from the till.
// Returns true when the Delete control was clicked (or the row was already gone).
async function deletePendingInOM(page, ref) {
  const omPage = await page.context().newPage();
  try {
    await omPage.goto(URLS.orderManagement);
    await sleep(3000);
    const tabBtn = omPage.getByRole('button', { name: /pending orders/i }).first();
    if (await tabBtn.count()) await tabBtn.click({ timeout: 15000 });
    else await omPage.getByText('Pending Orders', { exact: true }).first().click();
    await sleep(2500);
    const pendRow = omPage.locator('tr', { hasText: ref }).first();
    if (!(await pendRow.count())) { console.log(`OM: no row for ${ref} (already gone?)`); return true; }
    await pendRow.getByRole('button', { name: 'View Details' }).click();
    await sleep(2500);
    await expect(omPage.getByText(`Reference: #${ref}`).first()).toBeVisible({ timeout: 30000 });
    const delBtn = omPage.getByRole('button', { name: 'Delete Order' }).first();
    if (!(await delBtn.count())) { console.log(`OM: no Delete Order control for ${ref}`); return false; }
    await delBtn.click();
    await sleep(2000);
    const confirm = omPage.getByRole('button', { name: /^(Yes|Confirm|Delete)$/ }).first();
    if (await confirm.count()) { await confirm.click(); await sleep(2000); }
    console.log(`PENDING DELETED VIA OM DETAILS: ${ref}`);
    return true;
  } finally {
    await omPage.close().catch(() => {});
  }
}

// Delete the pending order assigned to a given slot, via OM > Pending Orders
// > Details (proven path). Finds the row by its slot text, not by ref:
// pending refs are REUSED across runs (12 Nov 2026: two different pendings
// both carried PCEE-51002), so a ref lookup is ambiguous. Runs in a separate
// tab so the till page (and its cart) is never navigated.
// Returns true when the Delete control was clicked (or no row existed).
async function deletePendingOnSlot(page, slot) {
  const omPage = await page.context().newPage();
  try {
    await omPage.goto(URLS.orderManagement);
    await sleep(3000);
    const tabBtn = omPage.getByRole('button', { name: /pending orders/i }).first();
    if (await tabBtn.count()) await tabBtn.click({ timeout: 15000 });
    else await omPage.getByText('Pending Orders', { exact: true }).first().click();
    await sleep(2500);
    const pendRow = omPage.locator('tr', { hasText: slot }).first();
    if (!(await pendRow.count())) { console.log(`OM: no pending row on ${slot} (already gone?)`); return true; }
    await pendRow.getByRole('button', { name: 'View Details' }).click();
    await sleep(2500);
    const delBtn = omPage.getByRole('button', { name: 'Delete Order' }).first();
    if (!(await delBtn.count())) { console.log(`OM: no Delete Order control for the ${slot} pending`); return false; }
    await delBtn.click();
    await sleep(2000);
    const confirm = omPage.getByRole('button', { name: /^(Yes|Confirm|Delete)$/ }).first();
    if (await confirm.count()) { await confirm.click(); await sleep(2000); }
    console.log(`PENDING DELETED VIA OM DETAILS (was on ${slot})`);
    return true;
  } finally {
    await omPage.close().catch(() => {});
  }
}

module.exports = { completeTillSale, savePendingOnSlot, openPendingList, deletePendingInOM, deletePendingOnSlot };
