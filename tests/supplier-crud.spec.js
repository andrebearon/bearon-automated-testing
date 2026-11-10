// Scenario 3 — CRUD supplier: create (name + email + phone + address),
// verify saved details on the details page after reload, update (phone
// + description) and verify persisted after reload, then delete via the
// list-row kebab menu and verify gone from search.
// Probe facts (v0.3.633): Save appears only once the form is dirty; the
// details page is an edit form with no Delete; Delete lives in the row
// kebab menu (View / Delete). Phone is reformatted on load
// (081234567890 -> "+62 812 3456 7890"), so phones are compared digits-only.
// Test account (demo workspace "Cafe muse2") and mock data only.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const SUPPLIER = `Test Supp ${suffix}`;
const EMAIL = `supp${suffix}@example.com`;
const PHONE = '081234567890';
const PHONE_DIGITS = '6281234567890';
const PHONE2 = '089876543210';
const PHONE2_DIGITS = '6289876543210';
const ADDRESS = 'Jl. Test 1';
const CITY = 'Jakarta';
const DESCRIPTION = `Supplier CRUD test ${suffix}`;
const DESCRIPTION2 = `Supplier CRUD test ${suffix} — updated`;

test.afterEach(async ({ page }) => {
  // Best-effort cleanup of this run's supplier only (no-op if the test's
  // own delete step already removed it). Never fails the test.
  await h.bestEffort(`delete supplier ${SUPPLIER}`, async () => {
    await h.deleteByKebab(page, {
      listUrl: '/console/pos/dashboard/inventory/suppliers/',
      searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
    });
  });
});

test('supplier CRUD: create, verify, update, delete', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create ---------------------------------------------------------
  await h.createSupplier(page, {
    name: SUPPLIER, email: EMAIL, phone: PHONE,
    addressLine1: ADDRESS, city: CITY, description: DESCRIPTION,
  });

  // ---- 2. Verify saved details on the details page (after reload) -------
  await h.openSupplierDetails(page, SUPPLIER);
  await expect(page.locator('input[name="name"]')).toHaveValue(SUPPLIER);
  await expect(page.locator('input[name="email"]')).toHaveValue(EMAIL);
  const phoneVal = await page.locator('input[name="phone"]').inputValue();
  expect(phoneVal.replace(/\D/g, '')).toBe(PHONE_DIGITS);
  await expect(page.locator('input[name="addressLine1"]')).toHaveValue(ADDRESS);
  await expect(page.locator('input[name="city"]')).toHaveValue(CITY);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(DESCRIPTION);
  console.log(`SUPPLIER DETAILS VERIFIED: ${SUPPLIER} (${EMAIL}, phone digits ${PHONE_DIGITS}, ${ADDRESS}, ${CITY})`);

  // ---- 3. Update phone + description, verify persisted after reload -----
  await page.locator('input[name="phone"]').fill(PHONE2);
  await page.locator('textarea[name="description"]').fill(DESCRIPTION2);
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveBtn).toBeVisible({ timeout: 15000 });
  await saveBtn.click();
  await expect(page.getByText('Supplier saved successfully').first()).toBeVisible({ timeout: 30000 });
  await h.openSupplierDetails(page, SUPPLIER);
  const phoneVal2 = await page.locator('input[name="phone"]').inputValue();
  expect(phoneVal2.replace(/\D/g, '')).toBe(PHONE2_DIGITS);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(DESCRIPTION2);
  // The update must not have wiped the other fields.
  await expect(page.locator('input[name="email"]')).toHaveValue(EMAIL);
  await expect(page.locator('input[name="addressLine1"]')).toHaveValue(ADDRESS);
  console.log(`SUPPLIER UPDATE VERIFIED: phone -> digits ${PHONE2_DIGITS}, description updated, other fields intact`);

  // ---- 4. Delete via the row kebab menu, verify gone from search --------
  await h.deleteByKebab(page, {
    listUrl: '/console/pos/dashboard/inventory/suppliers/',
    searchTerm: SUPPLIER, label: `supplier ${SUPPLIER}`,
  });
  console.log(`SUPPLIER DELETED: ${SUPPLIER} (verified absent from search)`);
});
