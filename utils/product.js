// Category and product helpers: create, find, open, read stock, delete.
// UI facts (probe-verified, v0.3.633):
// - Product inputs have no <label>; fill by name attribute (name, sellingPrice).
// - Options tab: "Add option group" pre-creates the first value row. Save stays
//   disabled until combinations exist, and the ONLY way to generate them is the
//   "Stock per combination" switch (#trackVariantStock). There is no Generate button.
// - Add-ons tab: the group does NOT pre-create a choice row; every choice
//   needs an explicit "Add choice" click.
// - Option group / add-on names render only as input values, never page text.
// - The details page is an edit form with no Delete. Delete lives in the
//   products-list row kebab menu (View / Delete).
// - #trackInventory on the General tab makes PO receives and adjustments change stock.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

// Reuse-or-create: create the category only when a search shows it absent.
async function ensureCategory(page, name) {
  await page.goto(URLS.categories);
  const search = page.getByPlaceholder(/search categories/i).first();
  await search.fill(name);
  await sleep(1500);
  if (await page.getByText(name, { exact: true }).first().count()) {
    console.log(`CATEGORY REUSED: ${name}`);
    return 'reused';
  }
  await search.fill('');
  await page.getByRole('button', { name: 'Create Category' }).click();
  await page.getByPlaceholder('Enter category name').fill(name);
  await page.getByRole('button', { name: 'Add Category' }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30000 });
  console.log(`CATEGORY CREATED: ${name}`);
  return 'created';
}

async function selectCategoryInForm(page, categoryName) {
  await page.locator('[role="combobox"]').first().click();
  const option = page.getByRole('option', { name: categoryName }).first();
  // A page-level element intercepts pointer events on the option, so force the click.
  if (await option.count()) {
    await option.click({ force: true });
  } else {
    await page.getByText(categoryName).first().click({ force: true });
  }
}

// Fill the General Details tab of the product form.
async function fillProductGeneral(page, { name, category, price, description }) {
  await page.locator('input[name="name"]').fill(name);
  await selectCategoryInForm(page, category);
  await page.locator('input[name="sellingPrice"]').fill(String(price));
  if (description) {
    await page.locator('textarea[name="description"]').fill(description);
  }
}

// Options tab: one group with N values, then generate priced combinations.
async function fillProductOptions(page, { group, values }) {
  await page.getByRole('tab', { name: /options/i }).click();
  await page.getByRole('button', { name: /add option group/i }).first().click();
  await page.getByPlaceholder(/eg: Size/i).fill(group);
  for (let i = 0; i < values.length; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: /add value/i }).first().click();
      await sleep(800);
    }
    const valueInput = page.getByPlaceholder(/eg: Small/i).nth(i);
    await valueInput.fill(values[i].name);
    // The charge input directly follows the value input in the DOM.
    await valueInput.locator('xpath=following::input[1]').fill(String(values[i].charge));
  }
  const comboSwitch = page.locator('#trackVariantStock');
  if (await comboSwitch.count()) {
    if ((await comboSwitch.getAttribute('aria-checked')) !== 'true') {
      await comboSwitch.click();
      await expect(page.getByText(/combinations are for sale/i).first())
        .toBeVisible({ timeout: 30000 });
    }
  } else {
    throw new Error('fillProductOptions: #trackVariantStock switch not found — cannot generate combinations');
  }
}

// Add-ons tab: one group with N choices.
async function fillProductAddOns(page, { group, choices }) {
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await page.getByRole('button', { name: /add add-on group/i }).first().click();
  await page.getByPlaceholder(/eg: Extras/i).fill(group);
  for (let i = 0; i < choices.length; i++) {
    await page.getByRole('button', { name: /add choice/i }).first().click();
    await sleep(800);
    const choiceInput = page.getByPlaceholder(/eg: Extra shot/i).nth(i);
    await choiceInput.fill(choices[i].name);
    await choiceInput.locator('xpath=following::input[1]').fill(String(choices[i].price));
  }
}

// Fails loudly if Save is disabled (e.g. option group without combinations).
async function saveProductForm(page) {
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveBtn).toBeEnabled({ timeout: 30000 });
  await saveBtn.click();
  await sleep(2000);
}

// Search the product list by name; returns true when a row is visible.
async function findProductInList(page, productName) {
  await page.goto(URLS.products);
  const search = page.getByPlaceholder(/search products/i).first();
  await search.fill(productName);
  await sleep(1500);
  return (await page.getByText(productName, { exact: true }).first().count()) > 0;
}

// Open the product details (edit form) for a product by name.
async function openProductDetails(page, productName) {
  if (!(await findProductInList(page, productName))) {
    throw new Error(`Product not found in list: ${productName}`);
  }
  const row = page.locator('tr', { hasText: productName }).first();
  await row.getByRole('button', { name: 'View' }).first().click();
  await expect(page.locator('input[name="name"]')).toHaveValue(productName, { timeout: 30000 });
}

// Create a product with no options/add-ons. trackInventory turns on stock tracking.
async function createSimpleProduct(page, { name, category, price, description, trackInventory = false }) {
  await page.goto(URLS.products);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await fillProductGeneral(page, { name, category, price, description });
  if (trackInventory) {
    const sw = page.locator('#trackInventory');
    await expect(sw).toBeVisible({ timeout: 15000 });
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
  }
  await saveProductForm(page);
  if (!(await findProductInList(page, name))) {
    throw new Error(`Product not listed after create: ${name}`);
  }
  console.log(`PRODUCT CREATED: ${name} @ Rp${price} (trackInventory=${trackInventory})`);
}

// Read the "Current Stock" value from a product's Stocks History tab ("-" when never stocked).
async function getProductCurrentStock(page, productName) {
  await openProductDetails(page, productName);
  await page.getByRole('tab', { name: /stocks history/i }).click();
  await sleep(2000);
  const body = await page.locator('body').innerText();
  const m = body.match(/Current Stock\s*[|\n]\s*([^\n|]+)/);
  if (!m) throw new Error(`Current Stock line not found on Stocks History tab for ${productName}`);
  return m[1].trim();
}

// Delete a product via the products-list row kebab. Throws on failure; wrap in bestEffort() for cleanup.
async function deleteProductByKebab(page, productName) {
  await page.goto(URLS.products);
  const search = page.getByPlaceholder(/search products/i).first();
  await search.fill(productName);
  await sleep(1500);
  const row = page.locator('tr', { hasText: productName }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.locator('button').filter({ hasNotText: /.+/ }).first().click();
  await sleep(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await page.getByText('Delete', { exact: true }).last().click();
  }
  // The confirm dialog renders async; poll for it.
  let confirmed = false;
  for (let i = 0; i < 60; i++) {
    if (await page.getByText('Delete Confirmation').first().count()) {
      const dlg = page.locator('[role="dialog"], [role="alertdialog"]');
      const dlgDelete = dlg.getByRole('button', { name: 'Delete', exact: true }).first();
      if (await dlgDelete.count()) await dlgDelete.click();
      else await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      confirmed = true;
      break;
    }
    if ((await page.getByText(productName, { exact: true }).count()) === 0) break;
    await sleep(500);
  }
  console.log(`PRODUCT DELETE ${confirmed ? 'CONFIRMED' : 'no dialog seen'}: ${productName}`);
  await expect(page.getByText(productName, { exact: true })).toHaveCount(0, { timeout: 30000 });
  console.log(`DELETED: product ${productName}`);
}

module.exports = {
  ensureCategory, selectCategoryInForm,
  fillProductGeneral, fillProductOptions, fillProductAddOns, saveProductForm,
  findProductInList, openProductDetails, createSimpleProduct,
  getProductCurrentStock, deleteProductByKebab,
};
