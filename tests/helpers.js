// Shared helpers for the Bearon core-flow specs. NOT a spec file itself
// (Playwright only runs *.spec.js). All helpers are workspace-safe: they
// assert the console is on the demo workspace "Cafe muse2" before doing
// anything, and every helper that touches records only ever touches records
// created by the current run (unique names) or the shared "Auto Category"
// fixture. Nothing here touches "Muse cafe" or preserved records.
const { expect } = require('@playwright/test');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ensureWorkspace(page) {
  await page.goto('/console');
  await expect(page.getByRole('heading', { name: 'Home' }).first())
    .toBeVisible({ timeout: 30000 });
  const body = await page.locator('body').innerText();
  if (!/Cafe muse2/.test(body)) {
    throw new Error('ABORT: console is not on the "Cafe muse2" demo workspace');
  }
}

// Open the register if the dialog appears; tolerate an already-open register.
async function openRegisterIfNeeded(page) {
  const openRegister = page.getByRole('button', { name: 'Open Register' });
  let dialogPresent = false;
  try {
    await openRegister.first().waitFor({ state: 'visible', timeout: 30000 });
    dialogPresent = true;
  } catch {
    // No register dialog: register already open, proceed.
  }
  if (dialogPresent) {
    // Quirk (proven 2 Nov): clicking Open Register at displayed Rp0 does
    // nothing until a keypad digit is pressed first.
    // FIX (7 Nov 2026, scenario 10 run 1): the first Open Register click
    // can be swallowed (panel closes, session stays Closed) — if the
    // button is still there after the click, press a digit and click again.
    const keypadZero = page.getByRole('button', { name: '0', exact: true }).first();
    if (await keypadZero.count()) await keypadZero.click();
    await openRegister.first().click();
    await sleep(2000);
    if (await openRegister.count()) {
      console.log('OPEN REGISTER button still present after click — retrying keypad + click');
      const zero2 = page.getByRole('button', { name: '0', exact: true }).first();
      if (await zero2.count()) await zero2.click();
      await openRegister.first().click();
    }
    await expect(openRegister).toHaveCount(0, { timeout: 30000 });
  }
}

// Cash-register session helpers (scenario 10). The Cash Registers page
// lists registers; "Close session" on a row navigates to the till with a
// "Close Cash Register" panel (Register, Opening Float, Cash Sales,
// Expected Cash, Sales by Payment Method, Total Takings, Closing Cash
// keypad, Cancel / Close Register). Closing cash must be entered on the
// keypad. Returns { expectedCash, panelText }.
const REGISTER_PAGE = '/console/pos/dashboard/pos/cash-register/';

async function registerStatus(page, name) {
  await page.goto(REGISTER_PAGE);
  const row = page.locator('tr', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const text = await row.innerText();
  return /Open/.test(text) && !/Closed/.test(text) ? 'Open' : 'Closed';
}

async function closeRegisterSession(page, registerName) {
  await page.goto(REGISTER_PAGE);
  const row = page.locator('tr', { hasText: registerName }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  // Fail fast if the session is already closed: clicking a missing
  // "Close session" button retries until the test timeout (scenario 10
  // run 2 burned ~9 min this way in its finally block).
  if ((await row.getByRole('button', { name: 'Close session' }).count()) === 0) {
    throw new Error(`closeRegisterSession: ${registerName} has no "Close session" button (already Closed?)`);
  }
  await row.getByRole('button', { name: 'Close session' }).click({ timeout: 30000 });
  await expect(page.getByText('Close Cash Register')).toBeVisible({ timeout: 30000 });
  // The panel renders asynchronously in pieces (run 1: numbers rendered
  // before the register name; the finally's retry: name before numbers),
  // so wait until BOTH are present before reading.
  await page.waitForFunction((name) => {
    const t = document.body.innerText;
    return new RegExp(`Register:\\s*${name}`).test(t) && /Expected Cash\s*Rp[\d.,]+/.test(t);
  }, registerName, { timeout: 15000 });
  const panelText = await page.locator('body').innerText();
  // GUARD: never close another register's session by mistake.
  expect(panelText).toContain(`Register:\n${registerName}`);
  const m = panelText.match(/Expected Cash\s*Rp([\d.,]+)/);
  if (!m) throw new Error(`Expected Cash not found on close panel for ${registerName}`);
  const expectedCash = Number(m[1].replace(/[.,]/g, ''));
  console.log(`CLOSE PANEL ${registerName}: Expected Cash Rp${expectedCash} :: ${(panelText.match(/Cash Sales\s*Rp[\d.,]+/) || ['?'])[0]} :: ${(panelText.match(/Total Takings\s*Rp[\d.,]+/) || ['?'])[0]}`);
  // Enter the expected cash on the keypad (same Rp0 quirk as Open
  // Register: a digit press is needed before the action lands).
  for (const d of String(expectedCash)) {
    await page.getByRole('button', { name: d, exact: true }).first().click();
    await sleep(200);
  }
  await page.getByRole('button', { name: 'Close Register' }).click({ timeout: 30000 });
  await sleep(3000);
  await page.goto(REGISTER_PAGE);
  await expect(page.locator('tr', { hasText: registerName }).first()).toContainText('Closed', { timeout: 30000 });
  console.log(`REGISTER SESSION CLOSED: ${registerName} (closing cash Rp${expectedCash} = expected)`);
  return { expectedCash, panelText };
}

async function openRegisterSession(page, registerName = 'Default') {
  // FIX (7 Nov 2026, resume run): the Cash Registers page "Open session"
  // button only navigates to the till — it does NOT select that register
  // there. The till defaults to Default (already open), so
  // openRegisterIfNeeded silently no-ops and a non-default register
  // stays Closed (scenario 9 run 2: session never opened, All Logs
  // empty — and the spec's toContainText('Open') check was a false
  // positive because the row always contains the "Open session" button).
  // PROVEN path (probe 7 Nov ~13:0x SGT, Reg CRUD 27374855U Closed ->
  // Open -> Closed, Expected Rp0): on the till, the top bar has two
  // button[role=combobox] — Location, then Register. Pick the register
  // in the 2nd combobox (role=option), then the Open Register panel
  // appears; keypad 0 + Open Register opens the session. (The
  // comboboxes' ACCESSIBLE names are not their visible text, so
  // getByRole('combobox', {name}) finds 0 — use the CSS selector.)
  if ((await registerStatus(page, registerName)) === 'Open') {
    console.log(`REGISTER SESSION ALREADY OPEN: ${registerName}`);
    return;
  }
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  const combos = page.locator('button[role="combobox"]');
  await expect(combos.nth(1)).toBeVisible({ timeout: 30000 });
  const current = (await combos.nth(1).innerText()).trim();
  if (current !== registerName) {
    // Pick the register, then VERIFY the selector actually shows it:
    // scenario 9 run 3 flaked here — the option click landed but the
    // selection did not take, so no Open Register panel ever appeared
    // and openRegisterIfNeeded silently no-op'd (Default was still
    // selected and already open). Retry the pick once if unverified.
    for (let attempt = 0; attempt < 2; attempt++) {
      await combos.nth(1).click();
      await sleep(1500);
      const opt = page.getByRole('option', { name: registerName }).first();
      await expect(opt).toBeVisible({ timeout: 15000 });
      await opt.click({ timeout: 15000 });
      await sleep(2000);
      const shown = (await combos.nth(1).innerText()).trim();
      if (shown === registerName) {
        console.log(`TILL REGISTER SELECTED: ${registerName}`);
        break;
      }
      console.log(`TILL REGISTER PICK NOT APPLIED (shows "${shown}"), retrying`);
      if (attempt === 1) throw new Error(`Till register selector still shows "${shown}", expected ${registerName}`);
    }
  }
  // FIX (7 Nov 2026, scenario 10 run 1): the open can silently fail —
  // panel closes, session stays Closed (probe of the same steps passed
  // first try, so this is a race, not a missing control). Retry the
  // pick + open once before giving up.
  for (let openAttempt = 0; openAttempt < 2; openAttempt++) {
    await openRegisterIfNeeded(page);
    const status = await registerStatus(page, registerName);
    if (status === 'Open') {
      console.log(`REGISTER SESSION OPEN: ${registerName}`);
      return;
    }
    console.log(`OPEN ATTEMPT ${openAttempt} did not open ${registerName} — retrying pick + open`);
    await page.goto('/console/pos/dashboard/pos/sales/');
    await sleep(2000);
    const combos2 = page.locator('button[role="combobox"]');
    await expect(combos2.nth(1)).toBeVisible({ timeout: 30000 });
    await combos2.nth(1).click();
    await sleep(1500);
    await page.getByRole('option', { name: registerName }).first().click({ timeout: 15000 });
    await sleep(2000);
  }
  throw new Error(`Register ${registerName} still Closed after 2 open attempts`);
}

// Reuse-or-create: create the category only when a search shows it absent.
async function ensureCategory(page, name) {
  await page.goto('/console/pos/dashboard/inventory/categories/');
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
  if (await option.count()) {
    await option.click({ force: true });
  } else {
    await page.getByText(categoryName).first().click({ force: true });
  }
}

// Fill the General Details tab of the product form (name/category/price/desc).
async function fillProductGeneral(page, { name, category, price, description }) {
  await page.locator('input[name="name"]').fill(name);
  await selectCategoryInForm(page, category);
  await page.locator('input[name="sellingPrice"]').fill(String(price));
  if (description) {
    await page.locator('textarea[name="description"]').fill(description);
  }
}

// Options tab: one group with two values. Value rows render as
// [name input (ph "eg: Small"), charge input]; "Add option group" already
// creates the first value row, "Add value" appends another.
// FIX (6 Nov 2026, was a test bug not an app bug): merely defining the
// group/values is NOT enough — the form blocks Save with "Generate and
// price at least one combination, or remove the option group". There is
// no "Generate" button anywhere in the DOM; the combinations are created
// by the "Stock per combination" switch on this tab (#trackVariantStock).
// Turning it ON auto-generates one combination per value, priced from
// base price + value charge (Regular = base, Large = base + charge),
// and Save becomes enabled. Verified by probe 6 Nov: switch off ->
// Save disabled; switch on -> "2 of 2 combinations are for sale",
// Save enabled.
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
  // Generate + price the combinations via the "Stock per combination"
  // switch — without this Save stays disabled (see comment above).
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

// Add-ons tab: one group with one choice. Choice rows render as
// [name input (ph "eg: Extra shot"), price input]. Unlike Options, the
// group does NOT pre-create a choice row ("Nothing to pick from yet") —
// every choice needs an explicit "Add choice" click first (run 1 failed
// here by assuming the first row existed).
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

async function saveProductForm(page) {
  // Fail loudly (instead of clicking a dead button) if the form is not
  // submittable — e.g. an option group with no priced combination.
  const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveBtn).toBeEnabled({ timeout: 30000 });
  await saveBtn.click();
  // Post-save landing varies (list, or stays on details): wait briefly for
  // either, then let the caller navigate explicitly.
  await sleep(2000);
}

// Search the product list by name; returns true when a row is visible.
async function findProductInList(page, productName) {
  await page.goto('/console/pos/dashboard/inventory/products/');
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

// Complete one till sale for the run's own product. Returns the order ref.
// payment: 'Cash' (exact amount) or 'Card' (Confirm Order, no card details
// needed — proven by probe). orderType: 'Take Away' is applied via the
// Order Type dropdown and verified (6 Nov 2026 fix: the checkout view
// renders async, so the helper waits for it before touching type/note).
async function completeTillSale(page, { product, qty = 1, price, payment = 'Cash', note = '', orderType = null }) {
  await page.goto('/console/pos/dashboard/pos/sales/');
  for (let i = 0; i < qty; i++) {
    await page.getByText(product).first().click();
    await sleep(800);
  }
  // Cart quantity line must show the requested quantity before paying.
  if (qty > 1) {
    await expect(page.getByText(new RegExp(`${qty} pcs`, 'i')).first())
      .toBeVisible({ timeout: 15000 });
  }
  await page.getByRole('button', { name: /checkout/i }).first().click();
  // FIX (6 Nov 2026, was a test bug not an app bug): the checkout view
  // renders asynchronously — immediately after the Checkout click the
  // "Dine In" control and the notes input do NOT exist yet (probe:
  // both counts were 0 at +11ms, 1 at +1s). The old code guarded the
  // order-type switch and the note fill with non-waiting count() checks,
  // so both were SILENTLY SKIPPED and the sale went through as Dine In
  // with no note, while payment/confirm (auto-waiting locators) worked.
  // Wait for the checkout view first, and fail loudly if a requested
  // type/note cannot be applied, instead of silently falling back.
  await expect(page.getByText('Order Summary').first())
    .toBeVisible({ timeout: 30000 });
  let typeUsed = 'Dine In';
  if (orderType) {
    const typeBtn = page.locator('button', { hasText: 'Dine In' }).first();
    await typeBtn.click({ timeout: 30000 });
    const opt = page.getByRole('option', { name: orderType }).first();
    await expect(opt).toBeVisible({ timeout: 30000 });
    await opt.click();
    await expect(page.locator('button', { hasText: orderType }).first())
      .toBeVisible({ timeout: 30000 });
    typeUsed = orderType;
  }
  if (note) {
    const noteInput = page.getByPlaceholder(/add any notes/i).first();
    await expect(noteInput).toBeVisible({ timeout: 30000 });
    await noteInput.fill(note);
    await expect(noteInput).toHaveValue(note, { timeout: 10000 });
  }
  await page.getByText(payment, { exact: true }).first().click();
  if (payment === 'Cash') {
    const exact = page.getByRole('button', { name: /Exact amount/i });
    if (await exact.count()) {
      await exact.first().click();
    } else {
      await page.locator('input').first().fill(String(price * qty));
    }
  }
  await page.getByRole('button', { name: /Confirm Order|Confirm|Pay|Complete/i }).first().click();
  await expect(page.getByRole('button', { name: /New sale/i })).toBeVisible({ timeout: 30000 });
  // Receipt content renders asynchronously after "Order created successfully".
  await page.waitForFunction(
    () => /[A-Z]{2,4}-\d+/.test(document.body.innerText),
    { timeout: 30000 },
  );
  const receiptBody = await page.locator('body').innerText();
  const refMatch = receiptBody.match(/[A-Z]{2,4}-\d+/);
  if (!refMatch) throw new Error('No order reference found on the completed receipt');
  const ref = refMatch[0];
  console.log(`SALE COMPLETED: ${ref} (${product} x${qty} @ Rp${price}, ${payment}, ${typeUsed})`);
  const newSale = page.getByRole('button', { name: /New sale/i }).first();
  if (await newSale.count()) await newSale.click().catch(() => {});
  return { ref, typeUsed };
}

// Find an order in Order Management by ref. If the default date range
// excludes it, try widening the range once, then re-search.
async function findOrderInOM(page, ref) {
  await page.goto('/console/pos/dashboard/pos/order-management/');
  const search = page.getByPlaceholder(/search orders by refno/i).first();
  await search.fill(ref);
  await page.keyboard.press('Enter');
  try {
    await expect(page.getByText(ref).first()).toBeVisible({ timeout: 30000 });
    return;
  } catch {
    console.log(`OM: ${ref} not in default date range; trying a wider range`);
  }
  const rangeBtn = page.getByRole('button', { name: /\d{4}\s*-/ }).first();
  if (await rangeBtn.count()) {
    await rangeBtn.click();
    await sleep(1500);
    const preset = page.getByRole('button', { name: /all time|last 90 days|this year|last 30 days/i }).first();
    if (await preset.count()) {
      await preset.click();
      await sleep(1500);
      await search.fill(ref);
      await page.keyboard.press('Enter');
      await expect(page.getByText(ref).first()).toBeVisible({ timeout: 30000 });
      return;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error(`Order not found in Order Management: ${ref}`);
}

async function openOrderDetails(page, ref) {
  await findOrderInOM(page, ref);
  await page.getByText(ref).first().click();
  await expect(page.getByText(`Reference: #${ref}`).first()).toBeVisible({ timeout: 30000 });
}

// Best-effort wrapper: logs and never throws, so cleanup never fails a test.
async function bestEffort(label, fn) {
  try {
    const result = await fn();
    console.log(`CLEANUP OK: ${label}`);
    return result;
  } catch (e) {
    console.log(`CLEANUP SKIPPED: ${label}: ${e.message}`);
    return null;
  }
}

// ---- Suppliers + purchase orders (added 6 Nov 2026, scenarios 3–5) ----
// Probe findings (v0.3.633, read-only probes + one probe PO/supplier,
// both deleted afterwards):
// - Supplier form: NO Save button on the empty form. Save (and Undo)
//   appear only once the form is dirty (e.g. after filling the name).
//   Save redirects to the list with toast "Supplier saved successfully".
//   Phone is reformatted on load (081234567890 -> "+62 812 3456 7890"),
//   so verify phones digits-only.
// - Supplier list row: View button + a kebab (empty-text) button whose
//   menu is View / Delete. No Delete on the details page (it is an edit
//   form). Same kebab pattern on the purchase-order list rows.
// - PO create form: comboboxes are Location / Supplier / Payment terms
//   (in that order). Supplier must be picked explicitly when more than
//   one supplier exists. "Add Product" opens a "Select a product"
//   dialog with a search input; picking a product adds a line row whose
//   Cost is the first text input and Quantity the number input.
//   Order Summary Subtotal = cost x qty. Create redirects to the list;
//   the new PO's ref (#051168001-style) is read from its list row.
// - PO details Actions: Receive stock, Update Details, Update Status,
//   Print, Send Invoice. Update Status offers: Pending, Invoiced,
//   Pending Payment, Paid Pending Received, Partially Received,
//   Received, Cancelled. Receive dialog: "N of M received" + a number
//   input; confirming sets Status Received and shows "This delivery has
//   been received and added to stock."
// - A Received PO CAN be deleted via the list-row kebab (proven by
//   probe-artifact cleanup 6 Nov 2026).

const SUPPLIERS_URL = '/console/pos/dashboard/inventory/suppliers/';
const PO_LIST_URL = '/console/pos/dashboard/inventory/purchase-orders/';
const PO_CREATE_URL = '/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=';

async function createSupplier(page, { name, email, phone, website, addressLine1, addressLine2, city, zipcode, description }) {
  await page.goto(SUPPLIERS_URL);
  await page.getByRole('button', { name: /add supplier/i }).first().click();
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(name);
  // Save appears only once the form is dirty (see comment above).
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
  await page.goto(SUPPLIERS_URL);
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

// Delete a supplier or PO by its list-row kebab menu (View / Delete).
// Verifies the row is gone from a fresh search. Throws on failure —
// callers that want best-effort wrap it in bestEffort().
async function deleteByKebab(page, { listUrl, searchTerm, label }) {
  await page.goto(listUrl);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(searchTerm);
  await sleep(2000);
  const row = page.locator('tr', { hasText: searchTerm }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.locator('button').nth(1).click();
  await sleep(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await page.getByText('Delete', { exact: true }).last().click();
  }
  // The "Delete Confirmation" dialog renders asynchronously — wait for it
  // (or for the row to vanish if the delete applies immediately) instead
  // of a non-waiting count() guard, which silently skipped the confirm
  // in supplier-crud run 1 and left the record behind.
  let confirmed = false;
  for (let i = 0; i < 60; i++) {
    // FIX (6 Nov late evening, scenario 4 run 2): a RECEIVED purchase
    // order shows a DIFFERENT dialog — "Delete a received purchase
    // order? … Deleting it will not reverse that stock. Continue?" —
    // not the generic "Delete Confirmation". The old poll only looked
    // for the generic text, so it never clicked Delete and the row
    // stayed. Accept either dialog title.
    const generic = await page.getByText('Delete Confirmation').first().count();
    const received = await page.getByText('Delete a received purchase order?').first().count();
    if (generic || received) {
      const dlg = page.locator('[role="dialog"], [role="alertdialog"]');
      const dlgDelete = dlg.getByRole('button', { name: 'Delete', exact: true }).first();
      if (await dlgDelete.count()) await dlgDelete.click();
      else await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      confirmed = true;
      break;
    }
    if ((await page.locator('tr', { hasText: searchTerm }).count()) === 0) break;
    await sleep(500);
  }
  console.log(`DELETE ${confirmed ? 'CONFIRMED' : 'no dialog seen'}: ${label}`);
  // Wait for the delete to land (row vanishes from the still-filtered
  // list) BEFORE navigating away — navigating immediately after the
  // confirm click can abort the in-flight delete request (run 2: the
  // confirm was clicked, yet the supplier was still listed).
  await expect(page.locator('tr', { hasText: searchTerm })).toHaveCount(0, { timeout: 30000 });
  await page.goto(listUrl);
  await sleep(2500);
  const search2 = page.getByPlaceholder(/search/i).first();
  await search2.fill(searchTerm);
  await sleep(2000);
  await expect(page.locator('tr', { hasText: searchTerm })).toHaveCount(0, { timeout: 30000 });
  console.log(`DELETED: ${label}`);
}

// Delete a product via the products-list row kebab menu (the product
// details page has no Delete control). Same async-confirm handling as
// deleteByKebab. Throws on failure — wrap in bestEffort() for cleanup.
async function deleteProductByKebab(page, productName) {
  await page.goto('/console/pos/dashboard/inventory/products/');
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

// Create a simple product (no options/add-ons). trackInventory turns on
// the General-tab #trackInventory switch so PO receives add stock.
async function createSimpleProduct(page, { name, category, price, description, trackInventory = false }) {
  await page.goto('/console/pos/dashboard/inventory/products/');
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

// Pick the supplier on the PO create/edit form. Combobox order is
// Location / Supplier / Payment terms.
async function selectSupplierInPOForm(page, supplierName) {
  const combo = page.locator('[role="combobox"]').nth(1);
  await expect(combo).toBeVisible({ timeout: 30000 });
  await combo.click();
  await sleep(1200);
  const opt = page.getByRole('option', { name: supplierName, exact: true }).first();
  if (await opt.count()) {
    await opt.click();
  } else {
    const txt = page.getByText(supplierName, { exact: true }).last();
    await expect(txt).toBeVisible({ timeout: 15000 });
    await txt.click();
  }
  await expect(combo).toContainText(supplierName, { timeout: 15000 });
}

// Create a PO against a supplier with one product line. Returns the ref
// (e.g. "#051168001") read from the list row after creation. Asserts the
// Order Summary subtotal equals cost x qty before submitting.
async function createPurchaseOrder(page, { supplier, product, cost, qty, notes }) {
  await page.goto(PO_CREATE_URL);
  await expect(page.getByText('Create Purchase Order').first()).toBeVisible({ timeout: 30000 });
  await selectSupplierInPOForm(page, supplier);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(2000);
  const dlgInput = page.locator('[role="dialog"] input').first();
  if (await dlgInput.count()) {
    await dlgInput.fill(product);
  } else {
    await page.getByPlaceholder(/search/i).first().fill(product);
  }
  await sleep(1500);
  const opt = page.getByRole('option', { name: product, exact: true }).first();
  if (await opt.count()) {
    await opt.click();
  } else {
    await page.getByText(product, { exact: true }).first().click();
  }
  const lineRow = page.locator('tr', { hasText: product }).first();
  await expect(lineRow).toBeVisible({ timeout: 30000 });
  await lineRow.locator('input[type="text"]').first().fill(String(cost));
  await lineRow.locator('input[type="number"]').first().fill(String(qty));
  if (notes) {
    await page.getByPlaceholder(/notes/i).first().fill(notes);
  }
  // Fail loudly (with the summary text) if the subtotal does not match
  // cost x qty, instead of submitting a wrong PO.
  const expected = cost * qty;
  try {
    await page.waitForFunction((exp) => {
      const t = document.body.innerText;
      const m = t.match(/Subtotal[\s\S]{0,60}?Rp([\d.,]+)/);
      return m && m[1].replace(/[.,]/g, '') === String(exp);
    }, expected, { timeout: 30000 });
  } catch {
    const body = await page.locator('body').innerText();
    const i = body.indexOf('Order Summary');
    throw new Error(`PO subtotal mismatch: expected Rp${expected}, summary was: ${body.slice(i, i + 400).replace(/\n+/g, ' | ')}`);
  }
  console.log(`PO SUBTOTAL VERIFIED: Rp${expected} (${product} ${qty} x Rp${cost})`);
  await page.getByRole('button', { name: 'Create Purchase Order', exact: true }).first().click();
  await page.waitForURL('**/purchase-orders/', { timeout: 30000 });
  await sleep(2000);
  // Read the ref from the new row (this supplier has only this run's PO).
  await page.goto(PO_LIST_URL);
  await sleep(2500);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(supplier);
  await sleep(2000);
  const row = page.locator('tr', { hasText: supplier }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const rowText = await row.innerText();
  const refMatch = rowText.match(/#\d+/);
  if (!refMatch) throw new Error(`No PO ref found in list row for ${supplier}: ${rowText}`);
  const ref = refMatch[0];
  console.log(`PO CREATED: ${ref} (supplier ${supplier}, ${product} ${qty} x Rp${cost})`);
  return ref;
}

async function openPurchaseOrderDetails(page, ref) {
  await page.goto(PO_LIST_URL);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(ref.replace('#', ''));
  await sleep(2000);
  const row = page.locator('tr', { hasText: ref.replace('#', '') }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.getByRole('button', { name: 'View' }).first().click();
  await expect(page.getByText('Purchase Order Details').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(ref, { exact: true }).first()).toBeVisible({ timeout: 30000 });
}

// Change the quantity (and optionally notes) of an existing PO via
// Update Details, then verify on the details page.
async function updatePurchaseOrderQty(page, ref, newQty) {
  await openPurchaseOrderDetails(page, ref);
  await page.getByRole('button', { name: /update details/i }).first().click();
  await expect(page.getByText('Update Purchase Order').first()).toBeVisible({ timeout: 30000 });
  const lineRow = page.locator('tr', { hasText: 'Rp' }).first();
  await lineRow.locator('input[type="number"]').first().fill(String(newQty));
  await page.getByRole('button', { name: 'Update Purchase Order', exact: true }).first().click();
  // FIX (6 Nov late evening, scenario 4 run 1): saving the update lands
  // on the PO LIST, not the details page — the old waitForURL(details)
  // timed out even though the update had saved (list showed Rp30,000).
  // Wait until the edit form has navigated away, then reopen details.
  await page.waitForURL((url) => !url.toString().includes('create'), { timeout: 30000 });
  await sleep(2000);
  await openPurchaseOrderDetails(page, ref);
}

// Receive a PO in full. Verifies Status becomes Received.
async function receivePurchaseOrder(page, ref, qty) {
  await openPurchaseOrderDetails(page, ref);
  await page.getByRole('button', { name: 'Receive stock', exact: true }).first().click();
  await expect(page.getByText(/received/i).first()).toBeVisible({ timeout: 30000 });
  const dlgInput = page.locator('[role="dialog"] input[type="number"]').first();
  if (await dlgInput.count()) {
    await dlgInput.fill(String(qty));
  } else {
    await page.locator('input[type="number"]').last().fill(String(qty));
  }
  await page.getByRole('button', { name: 'Receive stock', exact: true }).last().click();
  await expect(page.getByText('This delivery has been received and added to stock.').first())
    .toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Received', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  console.log(`PO RECEIVED: ${ref} (qty ${qty}, status Received)`);
}

// Submit one stock adjustment for a product (Manage Stocks page).
// The form: Location, Product combobox (search by name/SKU — the match
// renders as a button containing the product name, NOT a role=option),
// Reason native select, then a quantity number input that appears only
// AFTER the product is picked. Reason 'Damaged' etc. are expected to
// remove stock; 'Stock Received' adds it — the caller verifies the
// resulting Current Stock, so a wrong sign is caught by assertion.
async function createStockAdjustment(page, { product, qty, reason }) {
  await page.goto('/console/pos/dashboard/inventory/manage-stocks/');
  // A force-update toast ("A new version of Bearon is available") can
  // appear and cover the page — dismiss it with Later (never Update:
  // that signs the session out). Best-effort, short wait.
  try {
    const later = page.getByRole('button', { name: 'Later', exact: true }).first();
    await later.waitFor({ state: 'visible', timeout: 5000 });
    await later.click();
    await sleep(1000);
  } catch { /* no toast — proceed */ }
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg.first()).toBeVisible({ timeout: 30000 });
  // FIX (6 Nov late evening, scenario 6 run 1): the Product search input
  // only exists (visible) AFTER clicking the "Select a product"
  // combobox — filling it while the combobox is closed retries forever
  // (the run timed out the whole 600s on fill). Open the picker first,
  // then fill the search (the popover may portal outside the dialog, so
  // use a page-level locator), with an explicit timeout so a failure
  // surfaces in seconds, not minutes.
  // FIX (7 Nov 2026, resume run, scenario 6 run 2): the page-level
  // "Select a product" locator resolved to a HIDDEN duplicate (closed
  // popover/template) and the click waited the full 600 s even though
  // the dialog's own button was visible and enabled. Scope the picker
  // button to the dialog itself, and the pick option to :visible only.
  // Also re-dismiss a force-update toast if it appeared after the
  // dialog opened (it can cover the button).
  try {
    const later2 = page.getByRole('button', { name: 'Later', exact: true }).first();
    await later2.waitFor({ state: 'visible', timeout: 3000 });
    await later2.click();
    await sleep(800);
  } catch { /* no toast — proceed */ }
  // FIX (7 Nov 2026, resume run, scenario 6 fix #2 — probe-verified):
  // the picker is a <button role="combobox">, NOT role=button, so
  // getByRole('button') never matches it (that is why the dialog-scoped
  // fix #1 found "element(s) not found"). Probe 7 Nov 12:4x SGT:
  // dlg button[role=combobox] "Select a product" count 1, click opens
  // the search input. Use the CSS role selector.
  const pickerBtn = dlg.first().locator('button[role="combobox"]', { hasText: 'Select a product' });
  await expect(pickerBtn).toBeVisible({ timeout: 15000 });
  await pickerBtn.click({ timeout: 15000 });
  const search = page.getByPlaceholder(/search products by name or sku/i).first();
  await expect(search).toBeVisible({ timeout: 30000 });
  await search.fill(product, { timeout: 15000 });
  await sleep(2000);
  // FIX (7 Nov 2026, resume run, scenario 6 fix #3 — probe-verified):
  // the search results are DIV role=option ("No image / <name> / SKU:
  // ..."), NOT buttons — the old button:visible locator clicked some
  // unrelated button and the dialog stayed unpicked (no qty field ever
  // appeared). The product name is unique per run, so a regex on it
  // selects exactly the right option.
  const pick = page.getByRole('option', { name: new RegExp(product) }).first();
  await expect(pick).toBeVisible({ timeout: 30000 });
  await pick.click({ timeout: 15000 });
  await sleep(2000);
  console.log('ADJUST DIALOG AFTER PICK:', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 600));
  const qtyInput = dlg.locator('input[type="number"]').first();
  await expect(qtyInput).toBeVisible({ timeout: 30000 });
  await qtyInput.fill(String(qty));
  // Reason: the visible control is a Radix combobox ("Select an
  // option"); a hidden native <select> mirrors it (probe 7 Nov:
  // options "", Stock Received, Sales Return, Restock Found, Damaged,
  // Expired, Return to Vendor, Stock Shortage). Prefer the visible
  // control; fall back to the hidden select.
  const reasonBtn = dlg.first().locator('button[role="combobox"]', { hasText: 'Select an option' });
  if (await reasonBtn.count()) {
    await reasonBtn.click({ timeout: 15000 });
    await sleep(800);
    const opt = page.getByRole('option', { name: reason, exact: true });
    if (await opt.count()) {
      await opt.first().click({ timeout: 15000 });
    } else {
      await dlg.locator('select').nth(1).selectOption(reason);
    }
  } else {
    const reasonSelect = dlg.locator('select').nth(1);
    await reasonSelect.selectOption(reason);
  }
  // FIX (7 Nov 2026, resume run, scenario 6 fix #4 — FINAL attempt):
  // the Note field is required (at least for removal reasons): with it
  // empty the Submit button stays disabled and the click waits until
  // the 600 s test timeout. Proven by the failed-run snapshot: Reason
  // Damaged, qty 3, Change -3 pcs, New stock 7 pcs (arithmetic correct),
  // Note empty, Submit disabled. Fill it before submitting.
  const noteBox = dlg.getByPlaceholder(/why did this stock move/i);
  if (await noteBox.count()) {
    await noteBox.fill(`Test ${reason} ${qty} pcs`);
  }
  await page.getByRole('button', { name: /submit adjustment/i }).first().click({ timeout: 30000 });
  await expect(dlg).toHaveCount(0, { timeout: 30000 });
  await sleep(2000);
  console.log(`STOCK ADJUSTMENT SUBMITTED: ${product} qty ${qty}, reason ${reason}`);
}

// Read the "Current Stock" value from a product's Stocks History tab.
async function getProductCurrentStock(page, productName) {
  await openProductDetails(page, productName);
  await page.getByRole('tab', { name: /stocks history/i }).click();
  await sleep(2000);
  const body = await page.locator('body').innerText();
  const m = body.match(/Current Stock\s*[|\n]\s*([^\n|]+)/);
  if (!m) throw new Error(`Current Stock line not found on Stocks History tab for ${productName}`);
  return m[1].trim();
}

// --- Kitchen display helpers (scenario 8) ---
// The board is OFF by default ("Kitchen tickets are off, so new orders
// do not reach this screen"). The toggle lives in Settings > Features >
// POS ("Show orders on a kitchen screen", a role=switch). Returns the
// previous state so the caller can restore it.
// Generic POS feature switch (Settings > Features > POS), row-scoped by
// label — same row-matching rule as setKitchenTickets (ancestor text must
// contain the label AND be < 200 chars, or the first switch on the page
// matches every label). Returns the previous state.
async function setPosFeature(page, label, on) {
  await page.goto('/console/settings/features/pos/');
  await page.locator('[role="switch"]').first().waitFor({ timeout: 30000 });
  const found = await page.evaluate((label) => {
    const switches = [...document.querySelectorAll('[role="switch"]')];
    for (let i = 0; i < switches.length; i++) {
      let el = switches[i];
      for (let up = 0; up < 8 && el; up++) {
        const text = el.innerText || '';
        if (text.includes(label) && text.length < 200) {
          return { index: i, checked: switches[i].getAttribute('aria-checked') === 'true' };
        }
        el = el.parentElement;
      }
    }
    return null;
  }, label);
  if (!found) throw new Error(`POS feature switch not found: ${label}`);
  if (found.checked !== on) {
    await page.locator('[role="switch"]').nth(found.index).click();
    await sleep(2000);
  }
  console.log(`POS FEATURE "${label}": was ${found.checked ? 'ON' : 'OFF'}, set to ${on ? 'ON' : 'OFF'}`);
  return found.checked;
}

async function setKitchenTickets(page, on) {
  await page.goto('/console/settings/features/pos/');
  await page.locator('[role="switch"]').first().waitFor({ timeout: 30000 });
  const found = await page.evaluate(() => {
    const switches = [...document.querySelectorAll('[role="switch"]')];
    for (let i = 0; i < switches.length; i++) {
      let el = switches[i];
      for (let up = 0; up < 8 && el; up++) {
        const text = el.innerText || '';
        // The setting's own row is short (label + switch only). The whole
        // settings card also contains the label, so require a short text or
        // the first switch would match every label (bug seen 6 Nov: index 0
        // is "Allow staff to change the price", not the kitchen switch).
        if (text.includes('Show orders on a kitchen screen') && text.length < 200) {
          return { index: i, checked: switches[i].getAttribute('aria-checked') === 'true' };
        }
        el = el.parentElement;
      }
    }
    return null;
  });
  if (!found) throw new Error('Kitchen tickets switch not found in POS settings');
  if (found.checked !== on) {
    await page.locator('[role="switch"]').nth(found.index).click();
    await sleep(2000);
  }
  console.log(`KITCHEN TICKETS: was ${found.checked ? 'ON' : 'OFF'}, set to ${on ? 'ON' : 'OFF'}`);
  return found.checked;
}

const KITCHEN_BOARD_URL = '/console/pos/dashboard/pos/kitchen-display/display/?locationId=54&screenId=6';

async function openKitchenBoard(page) {
  await page.goto(KITCHEN_BOARD_URL);
  await expect(page.getByText('Not started').first()).toBeVisible({ timeout: 30000 });
}

// Poll the board (it refreshes on a ~60s poll) until the order ref appears.
async function waitForOrderOnBoard(page, ref, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await page.getByText(ref).first().count()) return true;
    console.log(`BOARD POLL ${attempt}: ${ref} not on board yet, reloading…`);
    await sleep(20000);
    await page.reload();
    await page.waitForTimeout(3000);
  }
  throw new Error(`Order ${ref} did not appear on the kitchen board within ${timeoutMs / 1000}s`);
}

// Click an action button on the board card for the given order ref, then
// poll until the card offers the expected next action (or, for the final
// step, until the Completed column count is >= 1).
async function progressKitchenOrder(page, ref, action, nextAction) {
  const card = page.locator('div', { hasText: ref }).filter({ has: page.getByRole('button', { name: action }) }).last();
  await expect(card.getByRole('button', { name: action }).first()).toBeVisible({ timeout: 60000 });
  await card.getByRole('button', { name: action }).first().click();
  await sleep(3000);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await page.reload();
    await page.waitForTimeout(3000);
    if (nextAction) {
      const next = page.locator('div', { hasText: ref }).filter({ has: page.getByRole('button', { name: nextAction }) }).last();
      if (await next.count()) return;
    } else if (await page.getByText(/Completed Orders \([1-9]/).first().count()) {
      return;
    }
    await sleep(15000);
  }
  throw new Error(`Kitchen order ${ref} did not move after "${action}" within 120s`);
}

module.exports = {
  sleep, ensureWorkspace, openRegisterIfNeeded, ensureCategory,
  selectCategoryInForm, fillProductGeneral, fillProductOptions,
  fillProductAddOns, saveProductForm, findProductInList,
  openProductDetails, completeTillSale, findOrderInOM, openOrderDetails,
  bestEffort,
  createSupplier, findSupplierInList, openSupplierDetails, deleteByKebab,
  deleteProductByKebab, createSimpleProduct, selectSupplierInPOForm, createPurchaseOrder,
  openPurchaseOrderDetails, updatePurchaseOrderQty, receivePurchaseOrder,
  getProductCurrentStock, createStockAdjustment,
  setKitchenTickets, openKitchenBoard, waitForOrderOnBoard, progressKitchenOrder,
  setPosFeature,
  closeRegisterSession, openRegisterSession, registerStatus,
};
