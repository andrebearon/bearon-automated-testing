/**
 * Scenario 07b — Product to order (the original smoke flow)
 *
 * Flow:
 *   1. Create a product (Rp10,000) in the shared "Auto Category".
 *   2. Sell it at the till: Cash, exact amount. Capture the order ref.
 *   3. Find the order in Order Management.
 *   4. Order Details show the product, Paid, Cash and Rp10,000.
 *
 * Data:    "Auto Test <suffix>" and its order.
 * Cleanup: tries to void the order if a Void control is available; otherwise
 *          the Paid order stays (known: usually no Void control here).
 * Notes:   Deliberately self-contained (inline steps, no product/till utils)
 *          so it keeps working as a smoke test even if a util regresses.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `Auto Test ${suffix}`;
const PRICE = 10000;

// Click by button role, then link role, then visible text.
async function clickText(page, text, opts = {}) {
  const byRole = page.getByRole('button', { name: text, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return; }
  const byLink = page.getByRole('link', { name: text, exact: true });
  if (await byLink.count()) { await byLink.first().click(); return; }
  await page.getByText(text, { exact: true }).first().click(opts);
}

// Inputs have no <label>; try label, then placeholder, then the name attribute.
async function fillField(page, label, value) {
  const re = new RegExp(label.source, 'i');
  const byLabel = page.getByLabel(re, { exact: false });
  if (await byLabel.count()) { await byLabel.first().fill(String(value)); return; }
  const byPlaceholder = page.getByPlaceholder(re, { exact: false });
  if (await byPlaceholder.count()) { await byPlaceholder.first().fill(String(value)); return; }
  const nameAttr = /product name/i.test(label.source) ? 'name'
    : /price/i.test(label.source) ? 'sellingPrice' : null;
  if (nameAttr) {
    const byName = page.locator(`input[name="${nameAttr}"]`);
    if (await byName.count()) { await byName.first().fill(String(value)); return; }
  }
  throw new Error(`Field not found: ${label}`);
}

test('product -> till sale -> order management -> order details', async ({ page }) => {
  await h.ensureWorkspace(page);

  // ---- 1. Create the product -------------------------------------------
  await page.goto(h.URLS.categories);
  if (!(await page.getByText(h.AUTO_CATEGORY).first().count())) {
    await page.getByRole('button', { name: 'Create Category' }).click();
    await page.getByPlaceholder('Enter category name').fill(h.AUTO_CATEGORY);
    await page.getByRole('button', { name: 'Add Category' }).click();
  }
  await expect(page.getByText(h.AUTO_CATEGORY).first()).toBeVisible({ timeout: 30000 });
  await page.goto(h.URLS.products);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.locator('input[name="name"]').fill(PRODUCT);
  await page.locator('[role="combobox"]').first().click();
  // A page-level element intercepts pointer events on the option, so force the click.
  const categoryOption = page.getByRole('option', { name: h.AUTO_CATEGORY }).first();
  if (await categoryOption.count()) {
    await categoryOption.click({ force: true });
  } else {
    await page.getByText(h.AUTO_CATEGORY).first().click({ force: true });
  }
  await page.locator('input[name="sellingPrice"]').fill(String(PRICE));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);

  // ---- 2. Sell it at the till (cash, exact amount) ----------------------
  await page.goto(h.URLS.till);
  // The Open Register dialog appears async; Rp0 needs a keypad digit before the click lands.
  const openRegister = page.getByRole('button', { name: 'Open Register' });
  let dialogPresent = false;
  try {
    await openRegister.first().waitFor({ state: 'visible', timeout: 30000 });
    dialogPresent = true;
  } catch {
    // No register dialog appeared: register already open, proceed.
  }
  if (dialogPresent) {
    const keypadZero = page.getByRole('button', { name: '0', exact: true }).first();
    if (await keypadZero.count()) await keypadZero.click();
    await openRegister.first().click();
    await expect(openRegister).toHaveCount(0, { timeout: 30000 });
  }
  await page.getByText(PRODUCT).first().click();
  await expect(page.getByText(`Rp${PRICE.toLocaleString('id-ID')}`).first()
    .or(page.getByText(String(PRICE)).first())).toBeVisible();
  await clickText(page, /Checkout|Pay|Confirm/);
  // Exact "Cash" only: /Cash/ matches a hidden "Cash register" span first.
  await page.getByText('Cash', { exact: true }).first().click();
  const exact = page.getByRole('button', { name: /Exact amount/i });
  if (await exact.count()) {
    await exact.first().click();
  } else {
    await fillField(page, /Money received|Amount received|Cash/, PRICE);
  }
  await clickText(page, /Confirm|Pay|Complete/);
  await expect(page.getByRole('button', { name: /New sale/i })).toBeVisible({ timeout: 30000 });
  // The receipt renders async; wait for a LETTERS-digits ref before reading.
  await page.waitForFunction(
    () => /[A-Z]{2,4}-\d+/.test(document.body.innerText),
    { timeout: 30000 },
  );
  const receiptBody = await page.locator('body').innerText();
  const refMatch = receiptBody.match(/[A-Z]{2,4}-\d+/);
  if (!refMatch) throw new Error('No order reference found on the completed receipt');
  const orderRef = refMatch[0];
  console.log(`SALE COMPLETED: ${orderRef} (${PRODUCT} x1 @ Rp${PRICE}, Cash)`);

  // ---- 3. Order appears in Order Management -----------------------------
  await page.goto(h.URLS.orderManagement);
  const search = page.getByPlaceholder(/Search|Order/i).first();
  if (await search.count()) {
    await search.fill(orderRef);
    await page.keyboard.press('Enter');
  }
  await expect(page.getByText(orderRef).first()).toBeVisible({ timeout: 30000 });
  console.log(`ORDER FOUND IN ORDER MANAGEMENT: ${orderRef}`);

  // ---- 4. Order Details match the sale ----------------------------------
  await page.getByText(orderRef).first().click();
  await expect(page.getByText(PRODUCT).first()).toBeVisible();
  await expect(page.getByText(/Paid/i).first()).toBeVisible();
  await expect(page.getByText(/Cash/i).first()).toBeVisible();
  const details = await page.locator('body').innerText();
  expect(details).toMatch(/10[.,]?000/);
  console.log(`ORDER DETAILS VERIFIED: ${orderRef} — ${PRODUCT}, Paid, Cash, Rp${PRICE}`);

  // ---- 5. Cleanup: void this run's own order only (best-effort) ---------
  try {
    const voidBtn = page.getByRole('button', { name: /Void/i }).first();
    if (await voidBtn.count() && await voidBtn.isEnabled()) {
      await voidBtn.click();
      const confirm = page.getByRole('button', { name: /Confirm|Void|Yes/i }).first();
      if (await confirm.count()) await confirm.click();
      console.log(`CLEANUP: void attempted for ${orderRef} (own order only)`);
    } else {
      console.log(`CLEANUP: no Void control available for ${orderRef}; order left as-is`);
    }
  } catch (e) {
    console.log(`CLEANUP: void skipped for ${orderRef}: ${e.message}`);
  }
});
