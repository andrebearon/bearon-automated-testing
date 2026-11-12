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
  // FIX (12 Nov 2026): the dialog's submit button is literally "Add Customer"
  // — the old anchored /^(Save|Create|Add)$/i never matched it, so the click
  // waited the whole 300s test timeout with the filled dialog open.
  await page.getByRole('button', { name: 'Add Customer' }).click();
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30000 });
  console.log(`CUSTOMER CREATED: ${NAME} ${EMAIL} ${PHONE}`);

  // ---- Update: the details page shows the phone as text ("+62..."); clicking
  // it reveals an inline editor. FIX (12 Nov 2026): the old step looked for
  // a phone input that only exists after that click, so it silently skipped
  // the whole update. The editor has no Save button — it saves on Enter.
  await page.getByText(NAME).first().click();
  await page.waitForTimeout(2500);
  const phoneText = page.getByText(`+${PHONE}`).first();
  await expect(phoneText).toBeVisible({ timeout: 15000 });
  await phoneText.click();
  await page.waitForTimeout(1000);
  const phone2 = page.locator('input[name="phone"], input[type="tel"]').first();
  await expect(phone2).toBeVisible({ timeout: 15000 });
  await phone2.fill(NEW_PHONE);
  await phone2.press('Enter');
  await page.waitForTimeout(2500);
  const det = await page.locator('body').innerText();
  expect(det).toContain(NEW_PHONE);
  console.log(`CUSTOMER UPDATED: phone -> ${NEW_PHONE}`);

  // ---- Delete via row kebab --------------------------------------------------
  // Customers list row buttons are [name] [Open customer] [kebab] — the
  // generic kebab index (1) opens the customer instead of the menu, so pass 2.
  await h.deleteByKebab(page, { listUrl: h.URLS.customers, searchTerm: NAME, label: 'customer', kebabIndex: 2 });
  console.log(`CUSTOMER DELETED: ${NAME}`);
});
