// Product workflow CRUD: create a product WITH A NEW CATEGORY, update its
// details / options (variants) / add-ons, verify everything saved, verify
// the new category is visible, update once more and verify it persisted,
// then delete the product and verify it is gone.
// Test account (demo workspace "Cafe muse2") and mock data only. Every run
// uses timestamp-suffixed names so runs never collide. No screenshots, no
// AI in the loop: Playwright asserts on DOM text/values only.
// Cleanup (best effort, never fails the test): delete this run's own
// product — and try its category — only AFTER all assertions pass.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
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
  // This spec does ~10 slow navigations through the VM proxy; the 300s
  // config timeout is too tight here (run 1 hit 5.2m and timed out).
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create a NEW category (part of the flow) ----------------------
  await h.ensureCategory(page, CATEGORY);

  // ---- 2. Create the product with details + options + add-ons -----------
  await page.goto('/console/pos/dashboard/inventory/products/');
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
  // Category shown on the details form.
  await expect(page.getByText(CATEGORY, { exact: true }).first()).toBeVisible();
  // Options (variants) saved. NOTE (6 Nov 2026 fix): the option group
  // name lives ONLY in an input value ("Option name #1" is the label),
  // so assert the input value, not page text. The values DO render as
  // combination headings once per-combination stock is on.
  await page.getByRole('tab', { name: /options/i }).click();
  await expect(page.getByPlaceholder(/eg: Size/i)).toHaveValue(OPTION_GROUP);
  await expect(page.getByText('Regular', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Large', { exact: true }).first()).toBeVisible();
  // Add-ons saved — same input-value rule: group and choice names are
  // input values, never visible text.
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await expect(page.getByPlaceholder(/eg: Extras/i)).toHaveValue(ADDON_GROUP);
  await expect(page.getByPlaceholder(/eg: Extra shot/i)).toHaveValue('Extra Cheese');
  console.log('DETAILS VERIFIED: name, category, price, description, options, add-ons');

  // ---- 4. Verify the new category is visible in the category list -------
  await page.goto('/console/pos/dashboard/inventory/categories/');
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
  // Reload the details page fresh and re-assert (not just the toast).
  await h.openProductDetails(page, PRODUCT);
  await expect(page.locator('input[name="sellingPrice"]')).toHaveValue(/30[.,]?000/);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(DESCRIPTION2);
  // The update must not have wiped options / add-ons (group and choice
  // names are input values — see the note in step 3).
  await page.getByRole('tab', { name: /options/i }).click();
  await expect(page.getByPlaceholder(/eg: Size/i)).toHaveValue(OPTION_GROUP);
  await expect(page.getByText('Large', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await expect(page.getByPlaceholder(/eg: Extra shot/i)).toHaveValue('Extra Cheese');
  console.log(`UPDATE VERIFIED: price Rp${PRICE} -> Rp${PRICE2}, description updated, options/add-ons intact`);

  // ---- 6. Delete the product and verify it is gone -----------------------
  // The delete control lives in the row's kebab menu (View / Delete) on
  // the products list — there is no Delete button on the details page.
  await page.goto('/console/pos/dashboard/inventory/products/');
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
  // A confirm dialog may appear; confirm it if it does.
  const confirmDelete = page.getByRole('button', { name: /^delete$/i }).first();
  if (await confirmDelete.count()) await confirmDelete.click();
  await expect(page.getByText(PRODUCT, { exact: true })).toHaveCount(0, { timeout: 30000 });
  console.log(`PRODUCT DELETED: ${PRODUCT} (verified absent from search)`);

  // ---- 7. Best-effort: remove this run's category too --------------------
  // Only after the product delete passed. If the category has no delete
  // control, it stays as a harmless leftover (one per run) — logged, not failed.
  await h.bestEffort(`delete category ${CATEGORY}`, async () => {
    await page.goto('/console/pos/dashboard/inventory/categories/');
    const s = page.getByPlaceholder(/search categories/i).first();
    await s.fill(CATEGORY);
    await h.sleep(1500);
    const catRow = page.locator('tr', { hasText: CATEGORY }).first();
    await expect(catRow).toBeVisible({ timeout: 15000 });
    const viewBtn = catRow.getByRole('button', { name: 'View' }).first();
    if (!(await viewBtn.count())) throw new Error('no View control on category row');
    await viewBtn.click();
    await h.sleep(2000);
    const delBtn = page.getByRole('button', { name: /delete/i }).first();
    if (!(await delBtn.count())) throw new Error('no Delete control on category page');
    await delBtn.click();
    await h.sleep(1200);
    const confirm = page.getByRole('button', { name: /^delete$/i }).first();
    if (await confirm.count()) await confirm.click();
    await expect(page.getByText(CATEGORY, { exact: true })).toHaveCount(0, { timeout: 30000 });
  });
});
