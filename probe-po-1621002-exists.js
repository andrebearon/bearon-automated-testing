// Read-only: is PO #051621002 still listed after a fresh load?
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/inventory/purchase-orders/');
  await page.getByPlaceholder(/search/i).first().fill('051621002');
  await page.waitForTimeout(2500);
  const rows = page.locator('tr', { hasText: '051621002' });
  console.log('ROWS FOR 051621002 AFTER FRESH LOAD:', await rows.count());
  if (await rows.count()) console.log('ROW TEXT:', (await rows.first().innerText()).replace(/\n/g, ' | '));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
