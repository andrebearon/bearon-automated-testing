const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/pos-settings/business-layout/');
  await page.waitForTimeout(3000);
  console.log('=== LAYOUT PAGE (first 2200) ===');
  console.log((await page.locator('body').innerText()).slice(0, 2200));
  console.log('BUTTONS:', JSON.stringify(await page.getByRole('button').allInnerTexts().then(a => a.filter(t => t.trim()))));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
