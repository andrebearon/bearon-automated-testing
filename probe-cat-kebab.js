// Read-only probe: category row kebab menu contents. No clicks on Delete.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/inventory/categories/');
  await page.getByPlaceholder(/search categories/i).first().fill('CRUD Cat 79456153');
  await page.waitForTimeout(1500);
  const row = page.locator('tr', { hasText: 'CRUD Cat 79456153' }).first();
  const kebab = row.locator('button').filter({ hasNotText: /.+/ }).first();
  await kebab.click();
  await page.waitForTimeout(1500);
  console.log('MENUITEMS:', await page.getByRole('menuitem').allInnerTexts().catch(() => []));
  console.log('MENU TEXT:', (await page.locator('[role="menu"]').innerText().catch(() => 'no menu role')));
  await page.keyboard.press('Escape');
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
