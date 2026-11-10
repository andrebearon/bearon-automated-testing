// Probe fix-1: product form Options tab — after filling an option group
// with two values, dump every button/label on the page to find the
// Generate-combinations control, and check Save disabled state + banner.
// Does NOT save anything.
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
  await sleep(1500);
  const body = await page.locator('body').innerText();
  console.log('=== OPTIONS TAB BODY ===\n' + body);
  console.log('=== ALL BUTTONS ===');
  const btns = await page.getByRole('button').allInnerTexts();
  console.log(JSON.stringify(btns, null, 1));
  const save = page.getByRole('button', { name: 'Save', exact: true });
  console.log('SAVE DISABLED:', await save.isDisabled().catch(e => 'err ' + e.message));
  // Look specifically for generate/combination controls
  for (const pat of [/generate/i, /combination/i, /variant/i, /price.*combination/i]) {
    console.log('MATCH', pat, 'count:', await page.getByText(pat).count(), 'buttons:', await page.getByRole('button', { name: pat }).count());
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
