// Probe 2: (a) supplier details page — Delete control? (b) supplier row
// kebab (empty button) — menu? (c) PO create — Add Product picker, fill a
// line, SUBMIT one probe PO, then dump the PO list + details page
// (ref format, Receive/Cancel/Delete/Edit controls, status flow).
// Creates one probe PO against probe supplier "Probe Sup 71149573".
// Both leftovers are logged at the end for cleanup by the specs/report.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

const SUPPLIER = 'Probe Sup 71149573';

async function dumpButtons(page, label) {
  const btns = await page.getByRole('button').allInnerTexts().catch(() => []);
  console.log(`--- BUTTONS ${label} ---`);
  console.log(JSON.stringify(btns.filter(t => t.trim()), null, 1));
}
async function bodySnippet(page, label, n = 2500) {
  console.log(`--- BODY ${label} ---`);
  console.log((await page.locator('body').innerText()).slice(0, n).replace(/\n+/g, ' | '));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);

  // ---- (a) Supplier details via View ----
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.count()) { await search.fill(SUPPLIER); await sleep(2000); }
  const row = page.locator('tr', { hasText: SUPPLIER }).first();
  console.log('SUPPLIER ROW FOUND:', await row.count());
  // Row kebab: the empty-text button in the row
  const rowBtns = row.locator('button');
  console.log('ROW BUTTON COUNT:', await rowBtns.count());
  for (let i = 0; i < await rowBtns.count(); i++) {
    console.log(` row button[${i}] text=${JSON.stringify(await rowBtns.nth(i).innerText().catch(() => '?'))} aria=${await rowBtns.nth(i).getAttribute('aria-label').catch(() => '')} title=${await rowBtns.nth(i).getAttribute('title').catch(() => '')}`);
  }
  // Click the empty (non-View) button if present — likely a kebab menu
  if ((await rowBtns.count()) > 1) {
    await rowBtns.nth(1).click().catch(e => console.log('kebab click err', e.message));
    await sleep(1500);
    await bodySnippet(page, 'AFTER ROW KEBAB CLICK', 1200);
    await dumpButtons(page, 'AFTER ROW KEBAB CLICK');
    await page.keyboard.press('Escape');
    await sleep(800);
  }
  // View -> details page
  await row.getByRole('button', { name: 'View' }).first().click();
  await sleep(3000);
  console.log('SUPPLIER DETAILS URL:', page.url());
  await bodySnippet(page, 'SUPPLIER DETAILS', 2000);
  await dumpButtons(page, 'SUPPLIER DETAILS');
  const detInputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} val=${(e.value || '').slice(0, 40)}`).slice(0, 30)).catch(() => []);
  console.log('DETAILS INPUTS:\n' + detInputs.join('\n'));

  // ---- (c) PO create: Add Product picker ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await bodySnippet(page, 'PO CREATE', 1500);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(2500);
  await bodySnippet(page, 'PO AFTER ADD PRODUCT', 3000);
  await dumpButtons(page, 'PO AFTER ADD PRODUCT');
  // Product picker: combobox? dialog? list?
  const combo = page.locator('[role="combobox"]');
  console.log('COMBOBOX COUNT after Add Product:', await combo.count());
  const dlg = page.locator('[role="dialog"], [role="listbox"]');
  console.log('DIALOG/LISTBOX COUNT:', await dlg.count());
  // Try typing a known product name into the first visible product input/combobox
  const prodInput = page.getByPlaceholder(/search.*product|select.*product|product/i).first();
  console.log('PRODUCT PLACEHOLDER INPUT COUNT:', await prodInput.count());
  if (await prodInput.count()) {
    await prodInput.fill('Sales Prod');
    await sleep(2000);
    await bodySnippet(page, 'PO AFTER TYPING Sales Prod', 2500);
    await dumpButtons(page, 'PO AFTER TYPING');
    const opt = page.getByRole('option', { name: /Sales Prod/ }).first();
    console.log('PRODUCT OPTION COUNT:', await opt.count());
    if (await opt.count()) { await opt.click(); await sleep(2000); }
    await bodySnippet(page, 'PO AFTER PRODUCT PICK', 3000);
    await dumpButtons(page, 'PO AFTER PRODUCT PICK');
  }
  // Fill cost + quantity on the line if inputs exist
  const lineInputs = await page.locator('input').evaluateAll(els =>
    els.map((e, i) => `[${i}] name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} val=${(e.value || '').slice(0, 20)} type=${e.getAttribute('type') || ''}`).slice(0, 40)).catch(() => []);
  console.log('ALL INPUTS AFTER PRODUCT PICK:\n' + lineInputs.join('\n'));
  // Cost and Quantity columns: find inputs by placeholder or position
  // Try filling by placeholder containing Cost / Quantity
  const costInput = page.getByPlaceholder(/cost/i).first();
  const qtyInput = page.getByPlaceholder(/qty|quantity/i).first();
  console.log('COST INPUT:', await costInput.count(), 'QTY INPUT:', await qtyInput.count());
  if (await costInput.count()) { await costInput.fill('10000'); await sleep(800); }
  if (await qtyInput.count()) { await qtyInput.fill('2'); await sleep(800); }
  // Notes
  const notes = page.getByPlaceholder(/notes/i).first();
  if (await notes.count()) { await notes.fill('Probe PO notes'); await sleep(500); }
  await bodySnippet(page, 'PO LINE FILLED', 3000);
  await dumpButtons(page, 'PO LINE FILLED');

  // ---- Submit the probe PO ----
  const createBtn = page.getByRole('button', { name: /create purchase order/i }).first();
  console.log('CREATE PO BUTTON:', await createBtn.count(), 'disabled:', await createBtn.isDisabled().catch(() => '?'));
  if (await createBtn.count() && !(await createBtn.isDisabled().catch(() => true))) {
    await createBtn.click();
    await sleep(5000);
    console.log('AFTER CREATE PO URL:', page.url());
    await bodySnippet(page, 'AFTER CREATE PO', 3000);
    await dumpButtons(page, 'AFTER CREATE PO');
  } else {
    console.log('CREATE PO BUTTON NOT CLICKABLE — stopping before submit');
  }

  // ---- PO list ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await bodySnippet(page, 'PO LIST', 3000);
  await dumpButtons(page, 'PO LIST');

  // ---- PO details: click first row / View ----
  const poRow = page.locator('tr').nth(1);
  console.log('PO ROW COUNT (tr):', await page.locator('tr').count());
  const viewBtn = page.getByRole('button', { name: /view/i }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await sleep(3000);
    console.log('PO DETAILS URL:', page.url());
    await bodySnippet(page, 'PO DETAILS', 3500);
    await dumpButtons(page, 'PO DETAILS');
  }
  console.log('\nPROBE2 DONE. Probe supplier:', SUPPLIER);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
