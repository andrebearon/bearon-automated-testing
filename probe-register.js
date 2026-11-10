const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/cash-register/');
  await page.waitForTimeout(4000);
  const body = await page.locator('body').innerText();
  console.log('=== REGISTER PAGE (first 2500 chars) ===');
  console.log(body.slice(0, 2500));
  console.log('=== BUTTONS ===');
  const btns = await page.getByRole('button').allInnerTexts();
  console.log(JSON.stringify(btns));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
