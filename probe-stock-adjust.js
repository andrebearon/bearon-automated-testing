// Read-only probe: Manage Stocks page + Create Stock Adjustment form structure.
// No stock changes are submitted.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/inventory/manage-stocks/');
  await page.waitForTimeout(2000);
  console.log('PAGE BUTTONS:', await page.locator('button').allInnerTexts().then(t => t.filter(x => x.trim()).slice(0, 30)));
  const adjBtn = page.getByRole('button', { name: /create stock adjustment/i }).first();
  console.log('ADJUST BUTTON COUNT:', await adjBtn.count());
  if (await adjBtn.count()) {
    await adjBtn.click();
    await page.waitForTimeout(2000);
    console.log('DIALOG TEXT:', (await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog role')).slice(0, 1200));
    console.log('SELECTS:', await page.locator('select').evaluateAll(els => els.map(e => ({ name: e.name, options: [...e.options].map(o => o.text).slice(0, 12) }))));
    console.log('INPUTS:', await page.locator('input').evaluateAll(els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, value: e.value })).slice(0, 20)));
    console.log('DIALOG BUTTONS:', await page.locator('[role="dialog"] button').allInnerTexts().catch(() => []));
  }
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
