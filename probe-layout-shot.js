const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY), viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/pos-settings/business-layout/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/layout-before.png', fullPage: false });
  await page.getByRole('button', { name: 'Add Row' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Add Column' }).click();
  await page.waitForTimeout(1500);
  console.log('AFTER ADD ROW+COL, BODY:', (await page.locator('body').innerText()).slice(0, 1200));
  await page.screenshot({ path: 'test-results/layout-after.png', fullPage: false });
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
