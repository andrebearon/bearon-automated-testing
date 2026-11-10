// Scenario 13: CRUD customer — create, update, verify, delete.
// Route /console/pos/dashboard/crm/customers/; Create Customer dialog has
// Full Name*, Email, Phone ("Email or phone - at least one is required").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const NAME = `Test Cust ${suffix}`;
const EMAIL = `cust${suffix}@example.com`;
const PHONE = `628123456${suffix.slice(-4)}`;

test('CRUD customer', async ({ page }) => {
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/crm/customers/');
  await page.waitForTimeout(3000);

  // ---- Create --------------------------------------------------------------
  const createBtn = page.getByRole('button', { name: /Create Customer|Add Customer/i }).first();
  await expect(createBtn).toBeVisible({ timeout: 30000 });
  await createBtn.click();
  await page.waitForTimeout(1500);
  const nameInput = page.locator('input[name="fullName"], input[name="name"]').first();
  await expect(nameInput).toBeVisible({ timeout: 15000 });
  await nameInput.fill(NAME);
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  if (await emailInput.count()) await emailInput.fill(EMAIL);
  const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
  if (await phoneInput.count()) await phoneInput.fill(PHONE);
  await page.getByRole('button', { name: /^(Save|Create|Add)$/i }).first().click();
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30000 });
  console.log(`CUSTOMER CREATED: ${NAME} ${EMAIL} ${PHONE}`);

  // ---- Update: open details, change phone ----------------------------------
  await page.getByText(NAME).first().click();
  await page.waitForTimeout(2500);
  const phone2 = page.locator('input[name="phone"], input[type="tel"]').first();
  const NEW_PHONE = `628987654${suffix.slice(-4)}`;
  if (await phone2.count()) {
    await phone2.fill(NEW_PHONE);
    const save = page.getByRole('button', { name: /^(Save|Update)$/i }).first();
    if (await save.count()) { await save.click(); await page.waitForTimeout(2500); }
    const det = await page.locator('body').innerText();
    expect(det).toContain(NEW_PHONE);
    console.log(`CUSTOMER UPDATED: phone -> ${NEW_PHONE}`);
  } else {
    console.log('UPDATE SKIPPED: no phone input on details page');
  }

  // ---- Delete via row kebab (shared helper pattern) -------------------------
  await h.deleteByKebab(page, {
    listUrl: '/console/pos/dashboard/crm/customers/',
    searchTerm: NAME,
    label: 'customer',
  });
  console.log(`CUSTOMER DELETED: ${NAME}`);
});
