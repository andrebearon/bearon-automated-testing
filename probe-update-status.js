const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await h.openOrderDetails(page, 'CEE-51017');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Update Status' }).click();
  await page.waitForTimeout(2000);
  console.log('=== UPDATE STATUS DIALOG ===');
  console.log((await page.locator('body').innerText()).slice(0, 1500));
  const btns = await page.getByRole('button').allInnerTexts();
  console.log('BUTTONS:', JSON.stringify(btns.filter(t => t.trim())));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
