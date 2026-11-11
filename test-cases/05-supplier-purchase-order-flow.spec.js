/**
 * Scenario 05 — New supplier + new purchase order, with stock effect
 *
 * Flow:
 *   1. Create a new supplier.
 *   2. Create a new stock-tracked product (Track Inventory ON); stock starts at "-".
 *   3. Create a PO against the supplier: 5 x Rp8,000 = Rp40,000.
 *   4. Verify the PO details (supplier, Pending, product, notes, amounts).
 *   5. Receive in full, verify Status Received.
 *   6. Verify the product's Current Stock is now 5.
 *   7. Delete the PO, then the supplier (asserted).
 *
 * Data:    "Combo Supp <suffix>", "Combo Prod <suffix>", the PO itself.
 * Cleanup: PO + supplier deleted by the test; product best-effort.
 *          afterEach repeats all three best-effort if the test failed.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const SUPPLIER = `Combo Supp ${suffix}`;
const PRODUCT = `Combo Prod ${suffix}`;
const PRICE = 12000;
const COST = 8000;
const QTY = 5;
const NOTES = `Combo PO test ${suffix}`;

let poRef = null;

test.afterEach(async ({ page }) => {
  if (poRef) {
    await h.bestEffort(`delete PO ${poRef}`, async () => {
      await h.deleteByKebab(page, {
        listUrl: h.URLS.purchaseOrders, searchTerm: poRef.replace('#', ''), label: `PO ${poRef}`,
      });
    });
  }
  await h.bestEffort(`delete supplier ${SUPPLIER}`, async () => {
    await h.deleteByKebab(page, {
      listUrl: h.URLS.suppliers, searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
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
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE,
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
    listUrl: h.URLS.purchaseOrders, searchTerm: poRef.replace('#', ''), label: `PO ${poRef}`,
  });
  console.log(`COMBO PO DELETED: ${poRef}`);
  poRef = null;
  await h.deleteByKebab(page, {
    listUrl: h.URLS.suppliers, searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
  });
  console.log(`COMBO SUPPLIER DELETED: ${SUPPLIER}`);

  // ---- 8. Best-effort: remove this run's product --------------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});
