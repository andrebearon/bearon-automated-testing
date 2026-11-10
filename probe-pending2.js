const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  const wasOn = await h.setPosFeature(page, 'Let staff hold open orders', true);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  await page.getByText('Auto Test 82204090', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  console.log('PANEL TEXT:', (await page.locator('body').innerText()).match(/Pending Orders[\s\S]{0,700}/)?.[0]);
  // Try the slot selector and Refresh.
  const slotBtn = page.getByRole('button', { name: /select a slot/i }).first();
  console.log('SLOT BTN COUNT:', await slotBtn.count());
  if (await slotBtn.count()) { await slotBtn.click(); await page.waitForTimeout(1500); console.log('AFTER SLOT CLICK:', (await page.locator('body').innerText()).match(/Pending Orders[\s\S]{0,900}/)?.[0]); }
  const refresh = page.getByRole('button', { name: 'Refresh' }).first();
  if (await refresh.count()) { await refresh.click(); await page.waitForTimeout(1500); console.log('AFTER REFRESH:', (await page.locator('body').innerText()).match(/Pending Orders[\s\S]{0,500}/)?.[0]); }
  // Clean up: close panel, clear cart, restore feature.
  await page.keyboard.press('Escape');
  const clear = page.getByRole('button', { name: /clear cart/i });
  if (await clear.count()) await clear.click();
  await h.setPosFeature(page, 'Let staff hold open orders', wasOn);
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
