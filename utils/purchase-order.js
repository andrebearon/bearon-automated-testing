// Purchase order helpers: create, open, update quantity, receive.
// UI facts (probe-verified, v0.3.633):
// - PO create needs a supplier. Form comboboxes are Location / Supplier /
//   Payment terms, in that order.
// - "Add Product" opens a "Select a product" dialog; the picked line's Cost is
//   its first text input and Quantity its number input. Subtotal = cost x qty.
// - Create redirects to the list; the ref (#051168001-style) is read from the row.
// - Details actions: Receive stock, Update Details, Update Status, Print,
//   Send Invoice. Saving Update Details lands on the LIST, not the details page.
// - Receiving shows "This delivery has been received and added to stock."
// - Delete lives in the list-row kebab menu: use common.deleteByKebab().
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

async function selectSupplierInPOForm(page, supplierName) {
  const combo = page.locator('[role="combobox"]').nth(1);
  await expect(combo).toBeVisible({ timeout: 30000 });
  await combo.click();
  await sleep(1200);
  const opt = page.getByRole('option', { name: supplierName, exact: true }).first();
  if (await opt.count()) {
    await opt.click();
  } else {
    const txt = page.getByText(supplierName, { exact: true }).last();
    await expect(txt).toBeVisible({ timeout: 15000 });
    await txt.click();
  }
  await expect(combo).toContainText(supplierName, { timeout: 15000 });
}

// Create a PO with one product line and assert the subtotal = cost x qty. Returns the ref, e.g. "#051168001".
async function createPurchaseOrder(page, { supplier, product, cost, qty, notes }) {
  await page.goto(URLS.purchaseOrderCreate);
  await expect(page.getByText('Create Purchase Order').first()).toBeVisible({ timeout: 30000 });
  await selectSupplierInPOForm(page, supplier);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(2000);
  const dlgInput = page.locator('[role="dialog"] input').first();
  if (await dlgInput.count()) {
    await dlgInput.fill(product);
  } else {
    await page.getByPlaceholder(/search/i).first().fill(product);
  }
  await sleep(1500);
  const opt = page.getByRole('option', { name: product, exact: true }).first();
  if (await opt.count()) {
    await opt.click();
  } else {
    await page.getByText(product, { exact: true }).first().click();
  }
  const lineRow = page.locator('tr', { hasText: product }).first();
  await expect(lineRow).toBeVisible({ timeout: 30000 });
  await lineRow.locator('input[type="text"]').first().fill(String(cost));
  await lineRow.locator('input[type="number"]').first().fill(String(qty));
  if (notes) {
    await page.getByPlaceholder(/notes/i).first().fill(notes);
  }
  const expected = cost * qty;
  try {
    await page.waitForFunction((exp) => {
      const t = document.body.innerText;
      const m = t.match(/Subtotal[\s\S]{0,60}?Rp([\d.,]+)/);
      return m && m[1].replace(/[.,]/g, '') === String(exp);
    }, expected, { timeout: 30000 });
  } catch {
    const body = await page.locator('body').innerText();
    const i = body.indexOf('Order Summary');
    throw new Error(`PO subtotal mismatch: expected Rp${expected}, summary was: ${body.slice(i, i + 400).replace(/\n+/g, ' | ')}`);
  }
  console.log(`PO SUBTOTAL VERIFIED: Rp${expected} (${product} ${qty} x Rp${cost})`);
  await page.getByRole('button', { name: 'Create Purchase Order', exact: true }).first().click();
  await page.waitForURL('**/purchase-orders/', { timeout: 30000 });
  await sleep(2000);
  // The supplier is unique to this run, so its only row is this PO.
  await page.goto(URLS.purchaseOrders);
  await sleep(2500);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(supplier);
  await sleep(2000);
  const row = page.locator('tr', { hasText: supplier }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const rowText = await row.innerText();
  const refMatch = rowText.match(/#\d+/);
  if (!refMatch) throw new Error(`No PO ref found in list row for ${supplier}: ${rowText}`);
  const ref = refMatch[0];
  console.log(`PO CREATED: ${ref} (supplier ${supplier}, ${product} ${qty} x Rp${cost})`);
  return ref;
}

async function openPurchaseOrderDetails(page, ref) {
  await page.goto(URLS.purchaseOrders);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(ref.replace('#', ''));
  await sleep(2000);
  const row = page.locator('tr', { hasText: ref.replace('#', '') }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.getByRole('button', { name: 'View' }).first().click();
  await expect(page.getByText('Purchase Order Details').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(ref, { exact: true }).first()).toBeVisible({ timeout: 30000 });
}

// Change the line quantity via Update Details, then reopen the details page.
async function updatePurchaseOrderQty(page, ref, newQty) {
  await openPurchaseOrderDetails(page, ref);
  await page.getByRole('button', { name: /update details/i }).first().click();
  await expect(page.getByText('Update Purchase Order').first()).toBeVisible({ timeout: 30000 });
  const lineRow = page.locator('tr', { hasText: 'Rp' }).first();
  await lineRow.locator('input[type="number"]').first().fill(String(newQty));
  await page.getByRole('button', { name: 'Update Purchase Order', exact: true }).first().click();
  await page.waitForURL((url) => !url.toString().includes('create'), { timeout: 30000 });
  await sleep(2000);
  await openPurchaseOrderDetails(page, ref);
}

// Receive a PO in full and verify Status becomes Received.
async function receivePurchaseOrder(page, ref, qty) {
  await openPurchaseOrderDetails(page, ref);
  await page.getByRole('button', { name: 'Receive stock', exact: true }).first().click();
  await expect(page.getByText(/received/i).first()).toBeVisible({ timeout: 30000 });
  const dlgInput = page.locator('[role="dialog"] input[type="number"]').first();
  if (await dlgInput.count()) {
    await dlgInput.fill(String(qty));
  } else {
    await page.locator('input[type="number"]').last().fill(String(qty));
  }
  await page.getByRole('button', { name: 'Receive stock', exact: true }).last().click();
  await expect(page.getByText('This delivery has been received and added to stock.').first())
    .toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Received', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`PO RECEIVED: ${ref} (qty ${qty}, status Received)`);
}

module.exports = {
  selectSupplierInPOForm, createPurchaseOrder, openPurchaseOrderDetails,
  updatePurchaseOrderQty, receivePurchaseOrder,
};
