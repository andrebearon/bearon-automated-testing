// Probe: on the till with an EMPTY cart, list all buttons (find the
// Pending Orders entry point) and check the Save Pending Order state.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(4000);
  const btns = await page.locator('button').allInnerTexts();
  console.log('TILL BUTTONS (empty cart):', JSON.stringify(btns.filter(b => b && b.length < 80)));
  const t = await page.locator('body').innerText();
  console.log('PENDING MENTIONS:', (t.match(/Pending[^\n|]*/g) || []).join(' ;; '));
  await browser.close();
  console.log('TILL PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
