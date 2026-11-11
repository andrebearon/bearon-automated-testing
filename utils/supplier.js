// Supplier helpers: create, find, open details.
// UI facts (probe-verified, v0.3.633):
// - The empty form has NO Save button; Save appears once the form is dirty.
//   Save redirects to the list with toast "Supplier saved successfully".
// - Phone is reformatted on load (081234567890 -> "+62 812 3456 7890"), so
//   compare phones digits-only.
// - Delete lives in the list-row kebab menu: use common.deleteByKebab().
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

async function createSupplier(page, { name, email, phone, website, addressLine1, addressLine2, city, zipcode, description }) {
  await page.goto(URLS.suppliers);
  await page.getByRole('button', { name: /add supplier/i }).first().click();
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(name);
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  if (email) await page.locator('input[name="email"]').fill(email);
  if (phone) await page.locator('input[name="phone"]').fill(phone);
  if (website) await page.locator('input[name="website"]').fill(website);
  if (addressLine1) await page.locator('input[name="addressLine1"]').fill(addressLine1);
  if (addressLine2) await page.locator('input[name="addressLine2"]').fill(addressLine2);
  if (city) await page.locator('input[name="city"]').fill(city);
  if (zipcode) await page.locator('input[name="zipcode"]').fill(zipcode);
  if (description) await page.locator('textarea[name="description"]').fill(description);
  await saveBtn.click();
  await expect(page.getByText('Supplier saved successfully').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`SUPPLIER CREATED: ${name}`);
}

async function findSupplierInList(page, name) {
  await page.goto(URLS.suppliers);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(name);
  await sleep(1500);
  return (await page.getByText(name, { exact: true }).first().count()) > 0;
}

async function openSupplierDetails(page, name) {
  if (!(await findSupplierInList(page, name))) {
    throw new Error(`Supplier not found in list: ${name}`);
  }
  const row = page.locator('tr', { hasText: name }).first();
  await row.getByRole('button', { name: 'View' }).first().click();
  await expect(page.locator('input[name="name"]')).toHaveValue(name, { timeout: 30000 });
}

module.exports = { createSupplier, findSupplierInList, openSupplierDetails };
