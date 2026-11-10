// Probe: save a pending order on Slot 2, then click its row in Show Orders
// and dump what happens (cart load? details? actions?).
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
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Save Pending Order' }).click();
  await page.waitForTimeout(2000);
  await page.getByText('Slot 2', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Save Order' }).click();
  await page.waitForTimeout(2500);
  console.log('SAVED ON SLOT 2');
  // Dialog should still be open — click Show Orders.
  await page.getByRole('button', { name: /Show Orders/ }).first().click();
  await page.waitForTimeout(2500);
  const t1 = await page.locator('body').innerText();
  console.log('TABLE:', t1.replace(/\n+/g, ' | ').slice(-900));
  const row = page.locator('table tbody tr').first();
  console.log('ROW COUNT:', await row.count());
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(3000);
    const t2 = await page.locator('body').innerText();
    console.log('AFTER ROW CLICK:', t2.replace(/\n+/g, ' | ').slice(-1500));
    const btns = await page.locator('button').allInnerTexts();
    console.log('BUTTONS:', JSON.stringify(btns.filter(b => b && b.length < 60)));
  }
  await browser.close();
  console.log('ROW PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
