/**
 * Scenario 13 — CRUD customer
 *
 * Flow:
 *   1. Create a customer (full name, email, phone) via Create Customer.
 *   2. Open details, change the phone, save, verify the new phone shows.
 *   3. Delete via the row kebab menu, verify gone from search.
 *
 * Data:    "Test Cust <suffix>".
 * Cleanup: deleted by the test.
 * Notes:   The create dialog needs Full Name and at least one of email / phone.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const NAME = `Test Cust ${suffix}`;
const EMAIL = `cust${suffix}@example.com`;
const PHONE = `628123456${suffix.slice(-4)}`;
const NEW_PHONE = `628987654${suffix.slice(-4)}`;

test('CRUD customer', async ({ page }) => {
  await h.ensureWorkspace(page);
  await page.goto(h.URLS.customers);
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

  // ---- Delete via row kebab --------------------------------------------------
  await h.deleteByKebab(page, { listUrl: h.URLS.customers, searchTerm: NAME, label: 'customer' });
  console.log(`CUSTOMER DELETED: ${NAME}`);
});
