/**
 * Scenario 06 — Manage stock via stock adjustments
 *
 * Flow:
 *   1. Create a stock-tracked product; verify Current Stock is "-".
 *   2. Stock adjustment "Stock Received" +10; verify Current Stock 10.
 *   3. Stock adjustment "Damaged" -3; verify Current Stock 7.
 *   4. Verify the products list shows the same stock as the editor (7).
 *
 * Data:    "Stock Prod <suffix>".
 * Cleanup: product deleted best-effort.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `Stock Prod ${suffix}`;
const PRICE = 10000;

test('manage stock: tracked product, add 10, remove 3, verify', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Own stock-tracked product, starts with no stock ----------------
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, {
    name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE,
    description: `Stock test product ${suffix}`, trackInventory: true,
  });
  const stock0 = await h.getProductCurrentStock(page, PRODUCT);
  console.log(`STOCK BEFORE: ${PRODUCT} Current Stock = "${stock0}"`);
  expect(stock0).toBe('-');

  // ---- 2. Add 10 via Stock Received ---------------------------------------
  await h.createStockAdjustment(page, { product: PRODUCT, qty: 10, reason: 'Stock Received' });
  const stock10 = await h.getProductCurrentStock(page, PRODUCT);
  console.log(`STOCK AFTER +10: ${PRODUCT} Current Stock = "${stock10}"`);
  expect(stock10).toMatch(/10/);

  // ---- 3. Remove 3 via Damaged --------------------------------------------
  await h.createStockAdjustment(page, { product: PRODUCT, qty: 3, reason: 'Damaged' });
  const stock7 = await h.getProductCurrentStock(page, PRODUCT);
  console.log(`STOCK AFTER -3: ${PRODUCT} Current Stock = "${stock7}"`);
  expect(stock7).toMatch(/\b7\b/);

  // ---- 4. Products list shows the same stock as the editor ----------------
  await page.goto(h.URLS.products);
  const search = page.getByPlaceholder(/search products/i).first();
  await search.fill(PRODUCT);
  await h.sleep(1500);
  const row = page.locator('tr', { hasText: PRODUCT }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const rowText = await row.innerText();
  expect(rowText).toMatch(/\b7\b/);
  console.log(`LIST STOCK MATCHES EDITOR: ${PRODUCT} list shows 7 pcs`);

  // ---- 5. Best-effort cleanup: delete this run's product -------------------
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});
