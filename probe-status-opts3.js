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
  await page.locator('[role="dialog"] [role="combobox"]').click();
  await page.waitForTimeout(1500);
  console.log('OPTIONS:', JSON.stringify(await page.getByRole('option').allInnerTexts()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  // Close dialog without saving.
  await page.locator('[role="dialog"] button', { hasText: 'Cancel' }).click().catch(() => {});
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
