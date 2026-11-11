/**
 * Scenario 02 — CRUD category
 *
 * Flow:
 *   1. Create a category, verify it in the list.
 *   2. Rename it via the details panel, reload, verify the new name exists
 *      and the old name is gone.
 *   3. Delete it via the row kebab menu, verify it is gone.
 *
 * Data:    "Cat CRUD <suffix>" renamed to "Cat CRUD <suffix>U".
 * Cleanup: the test deletes its own category.
 * Notes:   The details panel has name + Save + Close and NO Delete; Delete
 *          lives only in the row kebab menu.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const CATEGORY = `Cat CRUD ${suffix}`;
const CATEGORY2 = `Cat CRUD ${suffix}U`;

async function searchCategory(page, name) {
  await page.goto(h.URLS.categories);
  const search = page.getByPlaceholder(/search categories/i).first();
  await search.fill(name);
  await h.sleep(1500);
}

test('category CRUD: create, verify, rename, delete', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create ---------------------------------------------------------
  await h.ensureCategory(page, CATEGORY);
  await searchCategory(page, CATEGORY);
  await expect(page.getByText(CATEGORY, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`CATEGORY CREATED: ${CATEGORY}`);

  // ---- 2. Rename via the details panel, verify it persisted -------------
  await searchCategory(page, CATEGORY);
  const row = page.locator('tr', { hasText: CATEGORY }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.getByRole('button', { name: 'View' }).first().click();
  await h.sleep(1500);
  const nameInput = page.locator('input[name="name"]').first();
  await expect(nameInput).toHaveValue(CATEGORY);
  await nameInput.fill(CATEGORY2);
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await h.sleep(2000);
  await searchCategory(page, CATEGORY2);
  await expect(page.getByText(CATEGORY2, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  await searchCategory(page, CATEGORY);
  await expect(page.getByText(CATEGORY, { exact: true })).toHaveCount(0, { timeout: 30000 });
  console.log(`CATEGORY RENAMED: ${CATEGORY} -> ${CATEGORY2} (verified after reload)`);

  // ---- 3. Delete via the row kebab menu, verify it is gone --------------
  await searchCategory(page, CATEGORY2);
  const row2 = page.locator('tr', { hasText: CATEGORY2 }).first();
  await expect(row2).toBeVisible({ timeout: 30000 });
  await row2.locator('button').filter({ hasNotText: /.+/ }).first().click();
  await h.sleep(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await page.getByText('Delete', { exact: true }).last().click();
  }
  // The Delete Confirmation dialog renders asynchronously — poll for it.
  let confirmed = false;
  for (let i = 0; i < 60; i++) {
    if (await page.getByText('Delete Confirmation').first().count()) {
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      confirmed = true;
      break;
    }
    if ((await page.locator('tr', { hasText: CATEGORY2 }).count()) === 0) break;
    await h.sleep(500);
  }
  console.log(`DELETE CONFIRM: dialog seen=${confirmed}`);
  await expect(page.getByText(CATEGORY2, { exact: true })).toHaveCount(0, { timeout: 30000 });
  console.log(`CATEGORY DELETED: ${CATEGORY2} (verified absent from search)`);
});
