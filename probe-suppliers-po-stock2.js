// Read-only follow-up probe: supplier form bottom buttons, stock adjustment after product pick, Stock Count / Transfer Stock.
// Saves NOTHING. Selections in dropdowns only; never clicks Submit/Save.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function allButtons(page) {
  return await page.locator('button').evaluateAll(els =>
    els.map(b => `${(b.innerText || '').trim()} [disabled=${b.disabled}]`).filter(t => t.trim() && !t.startsWith('[disabled')).filter((v, i, a) => a.indexOf(v) === i)).catch(() => []);
}
async function dump(page, label) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, 4000).replace(/\n+/g, ' | '));
  console.log('BUTTONS:', (await allButtons(page)).join(' | '));
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} val=${(e.value || '').slice(0, 40)}`).slice(0, 60)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
  const selects = await page.locator('select').evaluateAll(els => els.map(s => `SELECT options=[${[...s.options].map(o => o.text.trim()).join(' / ').slice(0, 300)}]`)).catch(() => []);
  console.log('SELECTS:\n' + selects.join('\n'));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : '!!! CHECK WORKSPACE');

  // 1. Supplier form — full buttons incl. below fold
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /add supplier/i }).first().click();
  await sleep(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1000);
  await dump(page, 'ADD SUPPLIER FORM (scrolled to bottom)');
  // Is there a Save button? exact label?
  const saveBtn = page.getByRole('button', { name: /save|create supplier|add supplier/i });
  console.log('SAVE-LIKE BUTTONS count:', await saveBtn.count());
  for (let i = 0; i < await saveBtn.count(); i++) console.log(' save-like:', await saveBtn.nth(i).innerText().catch(() => '?'));
  // Leave without saving via sidebar link
  await page.getByRole('link', { name: /^Suppliers$/ }).first().click().catch(() => {});
  await sleep(2000);
  console.log('After leaving supplier form, URL:', page.url());

  // 2. Stock adjustment — pick a product, see quantity/preview/Submit state
  await page.goto('/console/pos/dashboard/inventory/manage-stocks/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  await sleep(2500);
  await dump(page, 'STOCK ADJUSTMENT FORM (empty)');
  const submitBefore = page.getByRole('button', { name: /submit adjustment/i }).first();
  console.log('Submit disabled before pick?', await submitBefore.isDisabled().catch(() => 'unknown'));
  // Product select: list options
  const prodSelect = page.locator('select').first();
  const opts = await prodSelect.locator('option').allInnerTexts().catch(() => []);
  console.log('PRODUCT SELECT OPTIONS:', opts.slice(0, 20).join(' | '));
  if (opts.length > 1) {
    await prodSelect.selectOption({ index: 1 });
    await sleep(2500);
    await dump(page, 'STOCK ADJUSTMENT FORM (product picked, NO submit)');
    const submitAfter = page.getByRole('button', { name: /submit adjustment/i }).first();
    console.log('Submit disabled after product pick (no qty/reason)?', await submitAfter.isDisabled().catch(() => 'unknown'));
    // Pick a reason too (still no submit)
    const reasonSelect = page.locator('select').nth(1);
    const rOpts = await reasonSelect.locator('option').allInnerTexts().catch(() => []);
    console.log('REASON OPTIONS:', rOpts.join(' | '));
  }
  // Close without submitting
  await page.getByRole('button', { name: /^close$/i }).first().click().catch(() => {});
  await sleep(1500);
  console.log('After Close, URL:', page.url());

  // 3. Stock Count + Transfer Stock buttons — what do they open?
  for (const name of [/stock count/i, /transfer stock/i]) {
    const b = page.getByRole('button', { name }).first();
    if (await b.count()) {
      await b.click();
      await sleep(2500);
      await dump(page, 'AFTER CLICK ' + String(name));
      const c = page.getByRole('button', { name: /^close$|cancel/i }).first();
      if (await c.count()) { await c.click().catch(() => {}); await sleep(1500); }
    }
  }

  // 4. PO gate: click "Add your first supplier" — where does it lead?
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const gate = page.getByRole('button', { name: /add your first supplier/i }).first();
  if (await gate.count()) { await gate.click(); await sleep(3000); console.log('PO gate button leads to URL:', page.url()); }

  await browser.close();
  console.log('\nPROBE-A2 DONE — nothing saved.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
