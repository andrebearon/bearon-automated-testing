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
  await page.waitForTimeout(1500);
  console.log('SELECTS:', JSON.stringify(await page.locator('select').evaluateAll(els => els.map(e => [...e.options].map(o => o.text)))));
  // Try clicking the Status field itself (may be a custom dropdown).
  const statusField = page.locator('text=Status').last();
  await statusField.click({ timeout: 5000 }).catch(e => console.log('status field click failed:', e.message.slice(0, 120)));
  await page.waitForTimeout(1500);
  const menuItems = await page.getByRole('option').allInnerTexts().catch(() => []);
  console.log('OPTIONS:', JSON.stringify(menuItems));
  const menuBtns = await page.getByRole('menuitem').allInnerTexts().catch(() => []);
  console.log('MENUITEMS:', JSON.stringify(menuBtns));
  console.log('DIALOG TEXT NOW:', (await page.locator('body').innerText()).slice(-600));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
