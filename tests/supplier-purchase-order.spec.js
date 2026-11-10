// Scenario 5 — Combined flow: new supplier + new PO against it in one
// flow, end to end; receive the PO and verify the product stock effect
// (the product is created with Track Inventory ON, so receiving must add
// stock — verified on the product's Stocks History tab, Current Stock);
// then cleanup both (PO first, then supplier) best-effort.
// Probe facts (v0.3.633): product form General tab has the
// #trackInventory switch ("Deduct stock on every sale and warn when it
// runs low"); a fresh tracked product shows Current Stock "-"; the PO
// receive dialog confirms with "This delivery has been received and
// added to stock." and Status becomes Received.
// Test account (demo workspace "Cafe muse2") and mock data only.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const SUPPLIER = `Combo Supp ${suffix}`;
const PRODUCT = `Combo Prod ${suffix}`;
const PRICE = 12000;
const COST = 8000;
const QTY = 5;
const NOTES = `Combo PO test ${suffix}`;

let poRef = null;

test.afterEach(async ({ page }) => {
  // Best-effort cleanup of this run's records only, PO first, then
  // supplier, then product. Never fails the test.
  if (poRef) {
    await h.bestEffort(`delete PO ${poRef}`, async () => {
      await h.deleteByKebab(page, {
        listUrl: '/console/pos/dashboard/inventory/purchase-orders/',
        searchTerm: poRef.replace('#', ''), label: `PO ${poRef}`,
      });
    });
  }
  await h.bestEffort(`delete supplier ${SUPPLIER}`, async () => {
    await h.deleteByKebab(page, {
      listUrl: '/console/pos/dashboard/inventory/suppliers/',
      searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
    });
  });
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});

test('supplier + purchase order combined flow with stock effect', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. New supplier ----------------------------------------------------
  await h.createSupplier(page, {
    name: SUPPLIER, email: `combo${suffix}@example.com`, phone: '081234567890',
    addressLine1: 'Jl. Combo 1', city: 'Jakarta', description: `Combo test supplier ${suffix}`,
  });

  // ---- 2. New stock-tracked product ---------------------------------------
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: 'Auto Category', price: PRICE,
    description: `Combo test product ${suffix}`, trackInventory: true,
  });
  const stockBefore = await h.getProductCurrentStock(page, PRODUCT);
  console.log(`STOCK BEFORE RECEIVE: ${PRODUCT} Current Stock = "${stockBefore}"`);
  expect(stockBefore).not.toContain(String(QTY));

  // ---- 3. New PO against the new supplier (5 x Rp8,000 = Rp40,000) -------
  poRef = await h.createPurchaseOrder(page, {
    supplier: SUPPLIER, product: PRODUCT, cost: COST, qty: QTY, notes: NOTES,
  });

  // ---- 4. Verify the PO in details ----------------------------------------
  await h.openPurchaseOrderDetails(page, poRef);
  const detailsBody = await page.locator('body').innerText();
  expect(detailsBody).toContain(SUPPLIER);
  expect(detailsBody).toContain('Pending');
  expect(detailsBody).toContain(PRODUCT);
  expect(detailsBody).toContain(NOTES);
  expect(detailsBody).toMatch(/Rp8[.,]000/); // unit price
  expect(detailsBody).toMatch(/Rp40[.,]000/); // line amount / total
  console.log(`COMBO PO VERIFIED: ${poRef} (${SUPPLIER}, Pending, ${PRODUCT} 5 x Rp8,000 = Rp40,000)`);

  // ---- 5. Receive in full, verify Status Received -------------------------
  await h.receivePurchaseOrder(page, poRef, QTY);

  // ---- 6. Verify the stock effect on the product --------------------------
  const stockAfter = await h.getProductCurrentStock(page, PRODUCT);
  console.log(`STOCK AFTER RECEIVE: ${PRODUCT} Current Stock = "${stockAfter}" (expected ${QTY})`);
  expect(stockAfter).toMatch(new RegExp(`\\b${QTY}\\b`));

  // ---- 7. Cleanup: PO first, then supplier (asserted) ---------------------
  await h.deleteByKebab(page, {
    listUrl: '/console/pos/dashboard/inventory/purchase-orders/',
    searchTerm: poRef.replace('#', ''), label: `PO ${poRef}`,
  });
  console.log(`COMBO PO DELETED: ${poRef}`);
  poRef = null;
  await h.deleteByKebab(page, {
    listUrl: '/console/pos/dashboard/inventory/suppliers/',
    searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
  });
  console.log(`COMBO SUPPLIER DELETED: ${SUPPLIER}`);

  // ---- 8. Best-effort: remove this run's product --------------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});
