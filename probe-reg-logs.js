// Diagnostic probe for scenario 9 step 4: does All Logs show an OPEN
// session's row, or only CLOSED sessions? Register Reg CRUD 28016852U
// is currently Open (left by the scenario-9 retry). Checks the modal
// while Open (with waits), then closes the session and checks again.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const REG = 'Reg CRUD 28016852U';
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('STATUS BEFORE:', await h.registerStatus(page, REG));
  const readLogs = async (label) => {
    await page.goto('/console/pos/dashboard/pos/cash-register/');
    await page.waitForTimeout(2500);
    await page.locator('tr', { hasText: REG }).first().getByRole('button', { name: 'All Logs' }).click();
    await page.waitForTimeout(8000);
    const t = await page.locator('body').innerText();
    const modal = t.match(/Cash Register Logs[\s\S]{0,1200}/)?.[0].replace(/\n+/g, ' | ');
    console.log(`${label}:`, modal);
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.waitForTimeout(1000);
  };
  await readLogs('LOGS WHILE OPEN');
  const c = await h.closeRegisterSession(page, REG);
  console.log('CLOSED, expectedCash Rp' + c.expectedCash);
  await readLogs('LOGS AFTER CLOSE');
  console.log('DEFAULT STATUS:', await h.registerStatus(page, 'Default'));
  await browser.close();
  console.log('PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
