// Probe supplier form interactively: fill the name and see whether a
// Save button appears (sticky footer when dirty? top-right?). Then SAVE
// one probe supplier (unique name) so the PO form can be probed with a
// supplier present. PO form: dump fields, select supplier, add a product
// line — but do NOT submit the PO. Leaves one probe supplier behind;
// the specs' cleanup will remove suppliers they create, this one is
// logged for manual cleanup if no delete control exists.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

const TS = Date.now().toString().slice(-8);
const SUPPLIER = `Probe Sup ${TS}`;

async function dumpButtons(page, label) {
  const btns = await page.getByRole('button').allInnerTexts().catch(() => []);
  console.log(`--- BUTTONS ${label} ---`);
  console.log(JSON.stringify(btns.filter(t => t.trim()), null, 1));
  const disabled = await page.locator('button:disabled').evaluateAll(els => els.map(b => (b.innerText || '').trim()).filter(Boolean)).catch(() => []);
  console.log('DISABLED BUTTONS:', JSON.stringify(disabled));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);

  // ---- 1. Supplier form, empty ----
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  console.log('SUPPLIERS LIST BODY:', (await page.locator('body').innerText()).slice(0, 1500).replace(/\n+/g, ' | '));
  await page.getByRole('button', { name: /add supplier/i }).first().click();
  await sleep(3000);
  console.log('ADD SUPPLIER URL:', page.url());
  await dumpButtons(page, 'EMPTY FORM');
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''}`).slice(0, 40)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));

  // ---- 2. Fill name only, check for Save appearing ----
  await page.locator('input[name="name"]').fill(SUPPLIER);
  await sleep(2000);
  await dumpButtons(page, 'AFTER NAME FILLED');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1000);
  await dumpButtons(page, 'AFTER NAME FILLED + SCROLLED TO BOTTOM');

  // ---- 3. Fill the rest and save if a Save-like button exists ----
  const saveLike = page.getByRole('button', { name: /save|create supplier|add supplier/i });
  console.log('SAVE-LIKE COUNT after name:', await saveLike.count());
  if (await saveLike.count()) {
    await page.locator('input[name="email"]').fill(`probe${TS}@example.com`).catch(e => console.log('email fill err', e.message));
    await page.locator('input[name="phone"]').fill('081234567890').catch(e => console.log('phone fill err', e.message));
    await page.locator('input[name="addressLine1"]').fill('Jl. Probe 1').catch(e => console.log('addr fill err', e.message));
    await page.locator('input[name="city"]').fill('Jakarta').catch(e => console.log('city fill err', e.message));
    await sleep(1000);
    await dumpButtons(page, 'FULLY FILLED');
    for (let i = 0; i < await saveLike.count(); i++) {
      console.log('save-like[' + i + ']:', JSON.stringify(await saveLike.nth(i).innerText().catch(() => '?')), 'disabled:', await saveLike.nth(i).isDisabled().catch(() => '?'));
    }
    const enabledSave = saveLike.filter({ hasNotText: /^$/ }).first();
    // Click the first enabled save-like button
    let clicked = false;
    for (let i = 0; i < await saveLike.count(); i++) {
      if (!(await saveLike.nth(i).isDisabled().catch(() => true))) {
        console.log('CLICKING save-like[' + i + ']:', await saveLike.nth(i).innerText());
        await saveLike.nth(i).click();
        clicked = true;
        break;
      }
    }
    if (!clicked) console.log('NO ENABLED SAVE BUTTON — supplier cannot be saved from this form?');
    await sleep(4000);
    console.log('AFTER SAVE CLICK URL:', page.url());
    console.log('AFTER SAVE BODY:', (await page.locator('body').innerText()).slice(0, 2000).replace(/\n+/g, ' | '));
    await dumpButtons(page, 'AFTER SAVE');
  } else {
    console.log('NO SAVE-LIKE BUTTON AT ALL on supplier form — APP BUG candidate');
  }

  // ---- 4. Suppliers list: row controls for the new supplier ----
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.count()) { await search.fill(SUPPLIER); await sleep(2000); }
  console.log('LIST AFTER SEARCH BODY:', (await page.locator('body').innerText()).slice(0, 2000).replace(/\n+/g, ' | '));
  await dumpButtons(page, 'SUPPLIER LIST (searched)');
  const row = page.locator('tr', { hasText: SUPPLIER }).first();
  console.log('ROW FOUND:', await row.count());
  if (await row.count()) {
    const rowBtns = await row.locator('button').allInnerTexts().catch(() => []);
    console.log('ROW BUTTONS:', JSON.stringify(rowBtns));
  }

  // ---- 5. PO create form (supplier now exists) ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  console.log('PO CREATE URL:', page.url());
  console.log('PO CREATE BODY:', (await page.locator('body').innerText()).slice(0, 3000).replace(/\n+/g, ' | '));
  await dumpButtons(page, 'PO CREATE FORM');
  const poInputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} val=${(e.value || '').slice(0, 30)}`).slice(0, 60)).catch(() => []);
  console.log('PO INPUTS:\n' + poInputs.join('\n'));
  const poSelects = await page.locator('select').evaluateAll(els => els.map(s => `SELECT name=${s.getAttribute('name') || ''} options=[${[...s.options].map(o => o.text.trim()).join(' / ').slice(0, 300)}]`)).catch(() => []);
  console.log('PO SELECTS:\n' + poSelects.join('\n'));
  // Try selecting the probe supplier in a combobox/select
  const supplierCombo = page.locator('[role="combobox"]').first();
  if (await supplierCombo.count()) {
    await supplierCombo.click().catch(e => console.log('combo click err', e.message));
    await sleep(1500);
    const opt = page.getByRole('option', { name: SUPPLIER }).first();
    console.log('SUPPLIER OPTION VISIBLE:', await opt.count());
    if (await opt.count()) { await opt.click(); await sleep(2000); }
    console.log('PO BODY AFTER SUPPLIER PICK:', (await page.locator('body').innerText()).slice(0, 3000).replace(/\n+/g, ' | '));
    await dumpButtons(page, 'PO FORM AFTER SUPPLIER PICK');
  }
  // Try "Add product" / add line
  const addLine = page.getByRole('button', { name: /add product|add item|add line/i }).first();
  console.log('ADD-LINE BUTTON COUNT:', await addLine.count());
  if (await addLine.count()) {
    await addLine.click();
    await sleep(2500);
    console.log('PO BODY AFTER ADD LINE:', (await page.locator('body').innerText()).slice(0, 3000).replace(/\n+/g, ' | '));
    await dumpButtons(page, 'PO FORM AFTER ADD LINE');
    const lineInputs = await page.locator('input, textarea, select').evaluateAll(els =>
      els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''}`).slice(0, 60)).catch(() => []);
    console.log('PO LINE INPUTS:\n' + lineInputs.join('\n'));
  }
  console.log('\nPROBE DONE. Probe supplier name:', SUPPLIER);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
