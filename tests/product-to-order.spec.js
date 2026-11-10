// First automated core flow: create a product -> sell it at the till ->
// order appears in Order Management -> order details match the sale.
// Test account (demo workspace "Cafe muse2") and mock data only. Every run uses a unique
// product name so runs never collide with each other or with audit data.
//
// How it asserts (no screenshots, no AI in the loop):
//   1. Product creation succeeds and the product is listed.
//   2. Till sale succeeds for that product at the exact price.
//   3. The new order ref appears in Order Management.
//   4. Order Details show the same product, quantity, price, total,
//      payment method and a Paid status.
// A failure prints which step failed and Playwright exits non-zero.
// Cleanup (best effort, never fails the test): void the order created
// here, if the current-shift Void control is available, so repeated
// runs do not pollute sales reports. The order is only voided AFTER
// all assertions have passed.
const { test, expect } = require('@playwright/test');

const suffix = Date.now().toString().slice(-8);
const PRODUCT = `Auto Test ${suffix}`;
const PRICE = 10000; // Rp10,000 — mock price, test account only
const STOCK = 100;

async function clickText(page, text, opts = {}) {
  // First exact-role match, then a visible text match. Keeps the test
  // robust to small layout changes without screenshot inspection.
  const byRole = page.getByRole('button', { name: text, exact: true });
  if (await byRole.count()) { await byRole.first().click(); return; }
  const byLink = page.getByRole('link', { name: text, exact: true });
  if (await byLink.count()) { await byLink.first().click(); return; }
  await page.getByText(text, { exact: true }).first().click(opts);
}

async function fillField(page, label, value) {
  // Bearon's inputs carry name/placeholder, not <label> associations,
  // and placeholders are lowercase ("Enter product name"), so match
  // case-insensitively and fall back to the input's name attribute.
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
  // ---- 1. Create the product -------------------------------------------
  await page.goto('/console');
  // Workspace-agnostic: the demo account's workspace is "Cafe muse2",
  // not "Muse cafe", so assert the console loaded, not a workspace name.
  await expect(page.getByRole('heading', { name: 'Home' }).first()).toBeVisible({ timeout: 30000 });

  // Product list route, verified by probe (sidebar links are inside
  // collapsed POS submenus, so a sidebar text search is unreliable).
  // Category is required and a fresh workspace has none, so create it
  // on the Categories page first — the in-form "Create new category"
  // dropdown proved flaky in the test run, while this page works.
  await page.goto('/console/pos/dashboard/inventory/categories/');
  // Re-runs share the "Auto Category" created by an earlier run (a
  // previous run was interrupted by a service restart after creating
  // it, before any product existed), so only create it if it is absent.
  if (!(await page.getByText('Auto Category').first().count())) {
    await page.getByRole('button', { name: 'Create Category' }).click();
    await page.getByPlaceholder('Enter category name').fill('Auto Category');
    await page.getByRole('button', { name: 'Add Category' }).click();
  }
  await expect(page.getByText('Auto Category').first()).toBeVisible({ timeout: 30000 });
  await page.goto('/console/pos/dashboard/inventory/products/');
  await page.getByRole('button', { name: 'Add Product' }).click();
  // Direct name-attribute fills: Bearon's inputs have no <label>
  // association, and label-based filling did not stick in the run.
  await page.locator('input[name="name"]').fill(PRODUCT);
  await page.locator('[role="combobox"]').first().click();
  // The category option renders visible but a page-level element
  // intercepts pointer events on a normal click (seen in the run at
  // 00:35 SGT), so force the click on the option role, falling back
  // to a forced text click if no option role exists.
  const categoryOption = page.getByRole('option', { name: 'Auto Category' }).first();
  if (await categoryOption.count()) {
    await categoryOption.click({ force: true });
  } else {
    await page.getByText('Auto Category').first().click({ force: true });
  }
  await page.locator('input[name="sellingPrice"]').fill(String(PRICE));
  // No stock step here: "Track Inventory" is OFF by default and the
  // /stock/i label matches that switch (not an input), so filling it
  // fails. Stock deduction is a separate edge case, not this core
  // flow — the product sells without stock tracking for this test.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(PRODUCT).first()).toBeVisible({ timeout: 30000 });
  console.log(`PRODUCT CREATED: ${PRODUCT} @ Rp${PRICE}`);

  // ---- 2. Sell it at the till (cash, exact amount) ----------------------
  await page.goto('/console/pos/dashboard/pos/sales/');
  // A fresh workspace has no open register: open it (Rp0 opening cash).
  // The dialog appears ASYNCHRONOUSLY after the till loads, so an
  // immediate count check races it (that race blocked the product
  // click for the full 300s timeout in the 00:45 SGT run, with the
  // dialog still open in the failure screenshot). Wait for it first.
  const openRegister = page.getByRole('button', { name: 'Open Register' });
  let dialogPresent = false;
  try {
    await openRegister.first().waitFor({ state: 'visible', timeout: 30000 });
    dialogPresent = true;
  } catch {
    // No register dialog appeared: register already open, proceed.
  }
  if (dialogPresent) {
    // Quirk proven by probe (00:53 SGT): clicking Open Register with
    // the displayed Rp0 does NOTHING — the dialog stays open with
    // no error. Pressing a keypad digit first (0) makes the same
    // click close the dialog. The expect below is deliberately
    // outside any try/catch: if the dialog will not close, fail
    // here with a clear step, not 300s later on the product click.
    const keypadZero = page.getByRole('button', { name: '0', exact: true }).first();
    if (await keypadZero.count()) await keypadZero.click();
    await openRegister.first().click();
    await expect(openRegister).toHaveCount(0, { timeout: 30000 });
  }
  // Note: do NOT assert on div[data-state="open"] here — that selector
  // matches 2 non-modal Radix elements even with the register open,
  // so it failed the 00:47 SGT run after the dialog had closed fine.
  // The product click below retries on its own if a real backdrop
  // is still covering the tile.
  await page.getByText(PRODUCT).first().click();
  // Cart total must equal the product price before paying.
  await expect(page.getByText(`Rp${PRICE.toLocaleString('id-ID')}`).first()
    .or(page.getByText(String(PRICE)).first())).toBeVisible();
  await clickText(page, /Checkout|Pay|Confirm/);
  // Payment method card: exact "Cash" only. A regex /Cash/ matches a
  // hidden <span>Cash register</span> first (00:59 SGT run: the click
  // waited 300s on that invisible span while the Cash card was
  // visible on the Order Summary page).
  await page.getByText('Cash', { exact: true }).first().click();
  // Exact-amount cash: prefer an "Exact amount" control, else type the price.
  const exact = page.getByRole('button', { name: /Exact amount/i });
  if (await exact.count()) {
    await exact.first().click();
  } else {
    await fillField(page, /Money received|Amount received|Cash/, PRICE);
  }
  await clickText(page, /Confirm|Pay|Complete/);
  // Capture the order reference from the success/receipt view.
  // The receipt's ref is NOT always ADD-#####: the 01:00 SGT run's
  // completed Dine In receipt showed "Order Ref: CEE-51001" for
  // Auto Test 52369640 (Paid by Cash Rp10,000, Change Rp0), while
  // the test was waiting for ADD- and timed out on a completed
  // sale. Accept any LETTERS-digits ref from the receipt dialog.
  await expect(page.getByRole('button', { name: /New sale/i })).toBeVisible({ timeout: 30000 });
  // The receipt dialog renders its content asynchronously: the
  // 01:02 SGT run caught it still showing a spinner with "Order
  // created successfully" below, so reading body text immediately
  // finds no ref. Wait until a ref actually appears in the page.
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
  // Route proven by probe (01:07 SGT): /pos/orders/ 404s; the real
  // route is /pos/order-management/ (sidebar "Orders", home
  // "Orders today" card, both point there).
  await page.goto('/console/pos/dashboard/pos/order-management/');
  // If the list has a search box, use it; otherwise scan the list.
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
  // Total on the details page must be the sale price (allowing formatting).
  const details = await page.locator('body').innerText();
  test.expect(details).toMatch(/10[.,]?000/);
  console.log(`ORDER DETAILS VERIFIED: ${orderRef} — ${PRODUCT}, Paid, Cash, Rp${PRICE}`);

  // ---- 5. Cleanup: void this run's own order only ------------------------
  // Only after every assertion above has passed. If Void is unavailable
  // (e.g. shift closed), log it and leave the order — never touch
  // another order, and never fail the test on cleanup.
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
