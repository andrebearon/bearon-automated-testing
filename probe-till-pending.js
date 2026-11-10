const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  // Add a product to the cart (existing test product, no order created yet).
  await page.getByText('Auto Test 82204090', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const body = await page.locator('body').innerText();
  console.log('CART AREA:', body.slice(body.indexOf('Cart'), body.indexOf('Cart') + 600).replace(/\n+/g, ' | '));
  const btns = await page.getByRole('button').allInnerTexts();
  console.log('BUTTONS:', JSON.stringify(btns.filter(t => t.trim())));
  // Clear the cart so nothing is left in progress.
  const clear = page.getByRole('button', { name: /clear cart/i });
  if (await clear.count()) { await clear.click(); console.log('CART CLEARED'); }
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
