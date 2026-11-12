/**
 * Scenario 01 — CRUD product (with new category, options and add-ons)
 *
 * Flow:
 *   1. Create a NEW category on the Categories page.
 *   2. Create a product in it with an option group (Size: Regular Rp0 /
 *      Large +Rp5,000) and an add-on group (Extras: Extra Cheese Rp3,000).
 *   3. Verify every saved field on the product details page.
 *   4. Verify the new category is listed.
 *   5. Update price + description, reload, verify it persisted and the
 *      options / add-ons are intact.
 *   6. Delete the product via the row kebab menu, verify it is gone.
 *
 * Data:    "CRUD Cat <suffix>", "CRUD Prod <suffix>".
 * Cleanup: product and category deleted by the test (category via the row
 *          kebab menu — the details panel has no Delete, see 02).
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const CATEGORY = `CRUD Cat ${suffix}`;
const PRODUCT = `CRUD Prod ${suffix}`;
const PRICE = 25000;
const PRICE2 = 30000;
const DESCRIPTION = `CRUD test product ${suffix}`;
const DESCRIPTION2 = `CRUD test product ${suffix} — updated`;
const OPTION_GROUP = 'Size';
const OPTION_VALUES = [
  { name: 'Regular', charge: 0 },
  { name: 'Large', charge: 5000 },
];
const ADDON_GROUP = 'Extras';
const ADDON_CHOICES = [{ name: 'Extra Cheese', price: 3000 }];

test('product CRUD with new category, options and add-ons', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create a NEW category ------------------------------------------
  await h.ensureCategory(page, CATEGORY);

  // ---- 2. Create the product with details + options + add-ons -----------
  await page.goto(h.URLS.products);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await h.fillProductGeneral(page, {
    name: PRODUCT, category: CATEGORY, price: PRICE, description: DESCRIPTION,
  });
  await h.fillProductOptions(page, { group: OPTION_GROUP, values: OPTION_VALUES });
  await h.fillProductAddOns(page, { group: ADDON_GROUP, choices: ADDON_CHOICES });
  await h.saveProductForm(page);
  if (!(await h.findProductInList(page, PRODUCT))) {
    throw new Error(`Product not listed after create: ${PRODUCT}`);
  }
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE} in ${CATEGORY}`);

  // ---- 3. Verify ALL saved data on the product details page -------------
  await h.openProductDetails(page, PRODUCT);
  await expect(page.locator('input[name="name"]')).toHaveValue(PRODUCT);
  await expect(page.locator('input[name="sellingPrice"]')).toHaveValue(/25[.,]?000/);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(DESCRIPTION);
  await expect(page.getByText(CATEGORY, { exact: true }).first()).toBeVisible();
  // Group / add-on names are input values, not page text; option values render as combination headings.
  await page.getByRole('tab', { name: /options/i }).click();
  await expect(page.getByPlaceholder(/eg: Size/i)).toHaveValue(OPTION_GROUP);
  await expect(page.getByText('Regular', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Large', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await expect(page.getByPlaceholder(/eg: Extras/i)).toHaveValue(ADDON_GROUP);
  await expect(page.getByPlaceholder(/eg: Extra shot/i)).toHaveValue('Extra Cheese');
  console.log('DETAILS VERIFIED: name, category, price, description, options, add-ons');

  // ---- 4. Verify the new category is visible in the category list -------
  await page.goto(h.URLS.categories);
  const catSearch = page.getByPlaceholder(/search categories/i).first();
  await catSearch.fill(CATEGORY);
  await h.sleep(1500);
  await expect(page.getByText(CATEGORY, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`CATEGORY VISIBLE: ${CATEGORY}`);

  // ---- 5. Update once more (price + description), verify it persisted ---
  await h.openProductDetails(page, PRODUCT);
  await page.locator('input[name="sellingPrice"]').fill(String(PRICE2));
  await page.locator('textarea[name="description"]').fill(DESCRIPTION2);
  await h.saveProductForm(page);
  await h.openProductDetails(page, PRODUCT);
  await expect(page.locator('input[name="sellingPrice"]')).toHaveValue(/30[.,]?000/);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(DESCRIPTION2);
  // The update must not have wiped options / add-ons.
  await page.getByRole('tab', { name: /options/i }).click();
  await expect(page.getByPlaceholder(/eg: Size/i)).toHaveValue(OPTION_GROUP);
  await expect(page.getByText('Large', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await expect(page.getByPlaceholder(/eg: Extra shot/i)).toHaveValue('Extra Cheese');
  console.log(`UPDATE VERIFIED: price Rp${PRICE} -> Rp${PRICE2}, description updated, options/add-ons intact`);

  // ---- 6. Delete the product (row kebab menu) and verify it is gone ------
  await page.goto(h.URLS.products);
  const search = page.getByPlaceholder(/search products/i).first();
  await search.fill(PRODUCT);
  await h.sleep(1500);
  const row = page.locator('tr', { hasText: PRODUCT }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const kebab = row.locator('button').filter({ hasNotText: /.+/ }).first();
  await kebab.click();
  await h.sleep(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await page.getByText('Delete', { exact: true }).last().click();
  }
  await h.sleep(1500);
  const confirmDelete = page.getByRole('button', { name: /^delete$/i }).first();
  if (await confirmDelete.count()) await confirmDelete.click();
  await expect(page.getByText(PRODUCT, { exact: true })).toHaveCount(0, { timeout: 30000 });
  console.log(`PRODUCT DELETED: ${PRODUCT} (verified absent from search)`);

  // ---- 7. Best-effort: remove this run's category too --------------------
  // Delete lives ONLY in the list row kebab menu — the details panel has no
  // Delete (see 02). The product is already gone, so the category is empty.
  await h.bestEffort(`delete category ${CATEGORY}`, async () => {
    await h.deleteCategoryByKebab(page, CATEGORY);
  });
});
