/**
 * Scenario 14 — POS sale with a customer; history in customer details
 *
 * Flow:
 *   1. Create a customer (full name, email, phone) via Create Customer.
 *   2. Create own product (Rp15,000).
 *   3. Cash sale with the customer selected at checkout.
 *   4. Open the customer details, verify the sale (order ref + Rp15,000)
 *      appears in their history.
 *
 * Data:    "Cust Sale <suffix>" customer, "Cust Sale Prod <suffix>" product.
 * Cleanup: order voided (terminal state — the app cannot delete sales
 *          orders), product + customer deleted.
 * Notes:   The till has no customer control on the cart — the picker lives
 *          in the checkout view ("Customer / Select a customer", probe
 *          12 Nov 2026, v0.3.659). The picker's submit button is
 *          "Add Customer" and the row kebab delete is button index 2
 *          (button 1 is "Open customer").
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const CATEGORY = h.AUTO_CATEGORY;
const NAME = `Cust Sale ${suffix}`;
const EMAIL = `custsale${suffix}@example.com`;
const PHONE = `628123456${suffix.slice(-4)}`;
const PRODUCT = `Cust Sale Prod ${suffix}`;
const PRICE = 15000;

test('POS sale with customer, history in customer details', async ({ page }) => {
  await h.ensureWorkspace(page);

  // ---- 1. Create the customer ----------------------------------------------
  await page.goto(h.URLS.customers);
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /Create Customer/i }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('input[name="fullName"], input[name="name"]').first().fill(NAME);
  await page.locator('input[name="email"], input[type="email"]').first().fill(EMAIL);
  await page.locator('input[name="phone"], input[type="tel"]').first().fill(PHONE);
  await page.getByRole('button', { name: 'Add Customer' }).click();
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30000 });
  console.log(`CUSTOMER CREATED: ${NAME} ${EMAIL} ${PHONE}`);

  // ---- 2. Own product for this run ------------------------------------------
  await h.ensureCategory(page, CATEGORY);
  await page.goto(h.URLS.products);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await h.fillProductGeneral(page, {
    name: PRODUCT, category: CATEGORY, price: PRICE,
    description: `Customer sale test product ${suffix}`,
  });
  await h.saveProductForm(page);
  if (!(await h.findProductInList(page, PRODUCT))) {
    throw new Error(`Product not listed after create: ${PRODUCT}`);
  }
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);

  // ---- 3. Cash sale with the customer selected at checkout ------------------
  await h.openRegisterIfNeeded(page);
  const sale = await h.completeTillSale(page, {
    product: PRODUCT, qty: 1, price: PRICE, payment: 'Cash', customer: NAME,
  });
  console.log(`SALE WITH CUSTOMER: ${sale.ref} Rp${PRICE} Cash, customer ${NAME}`);

  // Pin the sale down in Order Management first, so a history failure below
  // can only be the history display, not the sale itself.
  await h.findOrderInOM(page, sale.ref);
  const row = page.locator('tr', { hasText: sale.ref }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  console.log(`OM VERIFIED: ${sale.ref} listed`);

  // ---- 4. Customer details: the sale must appear in their history ----------
  await page.goto(h.URLS.customers);
  await page.waitForTimeout(3000);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(NAME);
  await page.waitForTimeout(2000);
  await page.getByText(NAME).first().click();
  await page.waitForTimeout(3000);
  const det = await page.locator('body').innerText();
  expect(det).toContain(sale.ref);
  expect(det).toContain('Rp15.000');
  console.log(`CUSTOMER HISTORY VERIFIED: ${sale.ref} Rp15.000 on ${NAME}`);

  // ---- Cleanup: void the order, delete the product and the customer ---------
  await h.bestEffort(`void order ${sale.ref}`, async () => {
    await h.openOrderDetails(page, sale.ref);
    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 30000 });
    await voidBtn.click();
    await page.locator('textarea').last().fill(`Customer sale void ${suffix}`);
    await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
    await h.sleep(2000);
    await page.reload();
    await expect(page.getByText('Voided', { exact: true }).first())
      .toBeVisible({ timeout: 30000 });
    console.log(`CLEANUP: order ${sale.ref} voided (verified after reload)`);
  });
  await h.bestEffort('delete product', async () => {
    await h.deleteProductByKebab(page, PRODUCT);
    console.log(`DELETED: product ${PRODUCT}`);
  });
  await h.bestEffort('delete customer', async () => {
    await h.deleteByKebab(page, {
      listUrl: h.URLS.customers, searchTerm: NAME, label: 'customer', kebabIndex: 2,
    });
    console.log(`DELETED: customer ${NAME}`);
  });
});
