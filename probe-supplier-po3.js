// Probe 3: (a) PO list row buttons (kebab/delete?); (b) PO create form
// combobox inventory — what is the Supplier control with 2 suppliers
// present, and can a different supplier be picked; (c) PO details
// "Update Status" dialog options (dump only, cancel); (d) PO details
// "Update Details" — what is editable; (e) RECEIVE the probe PO
// #051168001 (Rp0, qty 1) and observe status + any stock effect.
// Probe PO + probe supplier are test artifacts in "Cafe muse2" only.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

const SUPPLIER = 'Probe Sup 71149573';
const PO_REF = '#051168001';

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

  // ---- (a) PO list row buttons ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const poRow = page.locator('tr', { hasText: PO_REF }).first();
  console.log('PO ROW FOUND:', await poRow.count());
  const rowBtns = poRow.locator('button');
  console.log('PO ROW BUTTON COUNT:', await rowBtns.count());
  for (let i = 0; i < await rowBtns.count(); i++) {
    console.log(` po row button[${i}] text=${JSON.stringify(await rowBtns.nth(i).innerText().catch(() => '?'))}`);
  }
  if ((await rowBtns.count()) > 1) {
    await rowBtns.nth(1).click().catch(e => console.log('po kebab err', e.message));
    await sleep(1500);
    await bodySnippet(page, 'AFTER PO ROW KEBAB CLICK', 800);
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // ---- (b) PO create form comboboxes ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const combos = page.locator('[role="combobox"]');
  console.log('CREATE FORM COMBOBOX COUNT:', await combos.count());
  for (let i = 0; i < await combos.count(); i++) {
    const el = combos.nth(i);
    console.log(` combo[${i}] text=${JSON.stringify((await el.innerText().catch(() => '?')).slice(0, 80))} aria-label=${await el.getAttribute('aria-label').catch(() => '')}`);
  }
  // The Supplier control: find element containing supplier name, click it
  const supCtl = page.locator('text=Probe Sup 71149573').first();
  console.log('SUPPLIER TEXT LOCATOR COUNT:', await page.locator('text=Probe Sup 71149573').count());
  // Click the supplier value area (its parent button/combobox if any)
  const supBtn = page.locator('button', { hasText: SUPPLIER }).first();
  console.log('SUPPLIER BUTTON COUNT:', await supBtn.count());
  if (await supBtn.count()) {
    await supBtn.click();
    await sleep(2000);
    await bodySnippet(page, 'AFTER SUPPLIER CONTROL CLICK', 2000);
    await dumpButtons(page, 'AFTER SUPPLIER CONTROL CLICK');
    await page.keyboard.press('Escape');
    await sleep(800);
  } else {
    // Try clicking the text itself
    await supCtl.click({ force: true }).catch(e => console.log('sup text click err', e.message));
    await sleep(2000);
    await bodySnippet(page, 'AFTER SUPPLIER TEXT CLICK', 2000);
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // ---- (c)+(d)+(e) PO details ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/details/?purchaseOrderId=28', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await bodySnippet(page, 'PO DETAILS (before)', 1200);
  // Update Status dialog — dump only
  await page.getByRole('button', { name: /update status/i }).first().click();
  await sleep(2500);
  await bodySnippet(page, 'UPDATE STATUS DIALOG', 2000);
  await dumpButtons(page, 'UPDATE STATUS DIALOG');
  const statusSelects = await page.locator('select, [role="combobox"]').evaluateAll(els =>
    els.map(e => `${e.tagName} text=${(e.innerText || e.value || '').slice(0, 120)}`).slice(0, 10)).catch(() => []);
  console.log('STATUS DIALOG SELECTS/COMBOS:\n' + statusSelects.join('\n'));
  // Close the dialog without changing status
  const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).first();
  if (await cancelBtn.count()) { await cancelBtn.click(); await sleep(1500); }
  else await page.keyboard.press('Escape');
  await sleep(1000);

  // Update Details — dump the edit form, then leave without saving
  await page.getByRole('button', { name: /update details/i }).first().click();
  await sleep(3000);
  console.log('AFTER UPDATE DETAILS URL:', page.url());
  await bodySnippet(page, 'PO EDIT FORM', 3000);
  await dumpButtons(page, 'PO EDIT FORM');
  const editInputs = await page.locator('input').evaluateAll(els =>
    els.map((e, i) => `[${i}] name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} val=${(e.value || '').slice(0, 20)} type=${e.getAttribute('type') || ''}`).slice(0, 30)).catch(() => []);
  console.log('PO EDIT INPUTS:\n' + editInputs.join('\n'));

  // Back to details, then RECEIVE the probe PO
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/details/?purchaseOrderId=28', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /receive stock/i }).first().click();
  await sleep(2500);
  await bodySnippet(page, 'RECEIVE STOCK DIALOG', 3000);
  await dumpButtons(page, 'RECEIVE STOCK DIALOG');
  const recvInputs = await page.locator('input').evaluateAll(els =>
    els.map((e, i) => `[${i}] name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} val=${(e.value || '').slice(0, 20)} type=${e.getAttribute('type') || ''}`).slice(0, 30)).catch(() => []);
  console.log('RECEIVE INPUTS:\n' + recvInputs.join('\n'));
  // Confirm receive if a confirm button exists
  const confirmRecv = page.getByRole('button', { name: /receive|confirm|submit/i }).first();
  console.log('RECEIVE CONFIRM BUTTON COUNT:', await confirmRecv.count());
  if (await confirmRecv.count()) {
    console.log('RECEIVE CONFIRM TEXT:', await confirmRecv.innerText().catch(() => '?'));
    await confirmRecv.click();
    await sleep(5000);
    console.log('AFTER RECEIVE URL:', page.url());
    await bodySnippet(page, 'PO DETAILS AFTER RECEIVE', 2500);
    await dumpButtons(page, 'PO DETAILS AFTER RECEIVE');
  }
  console.log('\nPROBE3 DONE. Probe PO:', PO_REF, '| Probe supplier:', SUPPLIER);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
