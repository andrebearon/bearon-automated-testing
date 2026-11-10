// Focused probe: dump the Save Pending panel fully — slot controls, buttons, text.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const PRODUCT = 'Pend Probe 39083370';
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  await page.getByText(PRODUCT, { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2500);
  const text = await page.locator('body').innerText();
  console.log('FULL PANEL TEXT:', text.replace(/\n+/g, ' | ').slice(-2500));
  const buttons = await page.locator('button').allInnerTexts();
  console.log('ALL BUTTONS:', JSON.stringify(buttons));
  // Try clicking "Show Orders" — the panel header said "Pending Orders | Show Orders".
  const show = page.getByRole('button', { name: /Show Orders/ });
  console.log('SHOW ORDERS COUNT:', await show.count());
  if (await show.count()) {
    await show.first().click();
    await page.waitForTimeout(2500);
    const t2 = await page.locator('body').innerText();
    console.log('AFTER SHOW ORDERS:', t2.replace(/\n+/g, ' | ').slice(-2500));
    const b2 = await page.locator('button').allInnerTexts();
    console.log('BUTTONS AFTER:', JSON.stringify(b2));
  }
  await browser.close();
  console.log('PANEL PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
