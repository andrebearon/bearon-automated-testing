const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/cash-register/');
  await page.waitForTimeout(3000);
  const row = page.locator('tr', { hasText: 'Default' }).first();
  console.log('DEFAULT ROW:', (await row.innerText()).replace(/\n/g, ' | '));
  await row.getByRole('button', { name: 'All Logs' }).click();
  await page.waitForTimeout(2500);
  console.log('LOGS MODAL:', (await page.locator('body').innerText()).match(/Cash Register Logs[\s\S]{0,900}/)?.[0].replace(/\n+/g, ' | '));
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForTimeout(1000);
  // Reopen Default so later scenarios can run.
  await h.openRegisterSession(page, 'Default');
  console.log('DEFAULT REOPENED OK');
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
