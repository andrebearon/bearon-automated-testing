/**
 * Scenario 04 — CRUD purchase order
 *
 * Flow:
 *   1. Create own supplier + own simple product.
 *   2. Create a PO: 1 line, 2 x Rp10,000 = Rp20,000.
 *   3. Verify it in the list (supplier, Pending, Rp20,000) and in details.
 *   4. Update quantity 2 -> 3 via Update Details, verify Rp30,000.
 *   5. Receive in full, verify Status Received.
 *   6. Delete via the row kebab menu, verify gone.
 *
 * Data:    "PO Supp <suffix>", "PO Prod <suffix>", the PO itself.
 * Cleanup: PO deleted by the test; supplier + product best-effort.
 *          afterEach repeats all three best-effort if the test failed.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const SUPPLIER = `PO Supp ${suffix}`;
const PRODUCT = `PO Prod ${suffix}`;
const PRICE = 15000;
const COST = 10000;
const QTY = 2;
const QTY2 = 3;
const NOTES = `PO test ${suffix}`;

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

test('purchase order CRUD: create, verify, update qty, receive, delete', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Own supplier + own simple product ------------------------------
  await h.createSupplier(page, {
    name: SUPPLIER, email: `po${suffix}@example.com`, phone: '081234567890',
    addressLine1: 'Jl. PO 1', city: 'Jakarta', description: `PO test supplier ${suffix}`,
  });
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE,
    description: `PO test product ${suffix}`,
  });

  // ---- 2. Create the PO (1 line: qty 2 x Rp10,000 = Rp20,000) ------------
  poRef = await h.createPurchaseOrder(page, {
    supplier: SUPPLIER, product: PRODUCT, cost: COST, qty: QTY, notes: NOTES,
  });

  // ---- 3. Verify in the list + details -----------------------------------
  await page.goto(h.URLS.purchaseOrders);
  const listSearch = page.getByPlaceholder(/search/i).first();
  await listSearch.fill(poRef.replace('#', ''));
  await h.sleep(2000);
  const listRow = page.locator('tr', { hasText: poRef.replace('#', '') }).first();
  await expect(listRow).toBeVisible({ timeout: 30000 });
  const listRowText = await listRow.innerText();
  expect(listRowText).toContain(SUPPLIER);
  expect(listRowText).toMatch(/Pending/);
  expect(listRowText).toMatch(/Rp20[.,]000/);
  console.log(`PO LIST VERIFIED: ${poRef} (${SUPPLIER}, Pending, Rp20,000)`);
  await h.openPurchaseOrderDetails(page, poRef);
  const detailsBody = await page.locator('body').innerText();
  expect(detailsBody).toContain(SUPPLIER);
  expect(detailsBody).toContain('Pending');
  expect(detailsBody).toContain(PRODUCT);
  expect(detailsBody).toContain(NOTES);
  expect(detailsBody).toMatch(/Rp10[.,]000/); // unit price
  expect(detailsBody).toMatch(/Rp20[.,]000/); // line amount / total
  console.log(`PO DETAILS VERIFIED: ${poRef} (supplier, Pending, ${PRODUCT} 2 x Rp10,000 = Rp20,000, notes)`);

  // ---- 4. Update quantity 2 -> 3 via Update Details, verify -------------
  await h.updatePurchaseOrderQty(page, poRef, QTY2);
  const updatedBody = await page.locator('body').innerText();
  expect(updatedBody).toMatch(/Rp30[.,]000/); // 3 x Rp10,000
  expect(updatedBody).toContain(PRODUCT);
  console.log(`PO UPDATE VERIFIED: ${poRef} qty ${QTY} -> ${QTY2}, total Rp30,000`);

  // ---- 5. Receive in full, verify Status Received ------------------------
  await h.receivePurchaseOrder(page, poRef, QTY2);
  console.log(`PO RECEIVE VERIFIED: ${poRef} status Received`);

  // ---- 6. Delete via the row kebab menu, verify gone ---------------------
  await h.deleteByKebab(page, {
    listUrl: h.URLS.purchaseOrders, searchTerm: poRef.replace('#', ''), label: `PO ${poRef}`,
  });
  console.log(`PO DELETED: ${poRef} (verified absent from search)`);
  poRef = null;

  // ---- 7. Best-effort: remove this run's supplier + product --------------
  await h.bestEffort(`delete supplier ${SUPPLIER}`, async () => {
    await h.deleteByKebab(page, {
      listUrl: h.URLS.suppliers, searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
    });
  });
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});
