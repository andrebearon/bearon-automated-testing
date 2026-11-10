// Probe fix-2: till checkout page — dump every input/placeholder,
// order-type control, and notes-related element. Uses the existing
// baseline product "Sales Prod 70204048" (no sale completed, cart only).
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await sleep(3000);
  await page.getByText('Sales Prod 70204048').first().click();
  await sleep(1000);
  await page.getByRole('button', { name: /checkout/i }).first().click();
  await sleep(3000);
  const body = await page.locator('body').innerText();
  console.log('=== CHECKOUT BODY ===\n' + body);
  const inputs = await page.locator('input, textarea').evaluateAll(els => els.map(e => ({
    tag: e.tagName, ph: e.getAttribute('placeholder'), val: e.value, type: e.type, name: e.getAttribute('name'), ariaLabel: e.getAttribute('aria-label'),
  })));
  console.log('INPUTS/TEXTAREAS:', JSON.stringify(inputs, null, 1));
  console.log('=== BUTTONS ===', JSON.stringify(await page.getByRole('button').allInnerTexts()));
  // Dine In element details
  const dineIn = page.getByText('Dine In', { exact: true });
  console.log('DINE IN count:', await dineIn.count());
  if (await dineIn.count()) {
    console.log('DINE IN element:', await dineIn.first().evaluate(e => ({ tag: e.tagName, role: e.getAttribute('role'), cls: String(e.className).slice(0, 100), parentTag: e.parentElement?.tagName, parentCls: String(e.parentElement?.className).slice(0, 100) })));
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
