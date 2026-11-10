// Probe fix-1d: turn ON the "Stock per combination" switch
// (id trackVariantStock) and dump what appears: buttons, inputs,
// banner text, Save disabled state. Does NOT save.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/inventory/products/');
  await page.getByRole('button', { name: 'Add Product' }).click();
  await sleep(3000);
  await h.fillProductGeneral(page, { name: 'Probe Prod X', category: 'Auto Category', price: 10000, description: 'probe only' });
  await h.fillProductOptions(page, { group: 'Size', values: [{ name: 'Regular', charge: 0 }, { name: 'Large', charge: 5000 }] });
  await sleep(1200);
  const sw = page.locator('#trackVariantStock');
  console.log('SWITCH BEFORE:', await sw.getAttribute('aria-checked'));
  await sw.click();
  await sleep(2000);
  console.log('SWITCH AFTER:', await sw.getAttribute('aria-checked'));
  const body = await page.locator('body').innerText();
  // Print only the Options-tab region: from "Options" heading to end
  const idx = body.indexOf('Stock per combination');
  console.log('=== FROM STOCK-PER-COMBINATION ON ===\n' + body.slice(Math.max(0, idx - 200)));
  console.log('=== BUTTONS ===', JSON.stringify(await page.getByRole('button').allInnerTexts()));
  const save = page.getByRole('button', { name: 'Save', exact: true });
  console.log('SAVE DISABLED:', await save.isDisabled().catch(e => 'err ' + e.message));
  const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({ ph: e.getAttribute('placeholder'), val: e.value, type: e.type })));
  console.log('INPUTS:', JSON.stringify(inputs, null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
