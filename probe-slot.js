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
  // Click the first grid cell (empty square in the grid area).
  const cell = page.locator('div.grid, [class*="grid"]').locator('button, [role="button"]').first();
  console.log('GRID CELL BUTTONS:', await page.locator('main button').count());
  // Fallback: click at a grid coordinate (first cell approx x=520,y=360 in 1400x900).
  await page.mouse.click(520, 360);
  await page.waitForTimeout(2000);
  console.log('AFTER CELL CLICK, BODY TAIL:', (await page.locator('body').innerText()).slice(-1000));
  console.log('DIALOG?:', await page.locator('[role="dialog"]').count());
  await page.screenshot({ path: 'test-results/layout-cell-click.png' });
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
