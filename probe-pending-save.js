// Probe: click the Slot 1 cell (text, not button) in the Save Pending panel.
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
  const slot = page.getByText('Slot 1', { exact: true });
  console.log('SLOT 1 TEXT COUNT:', await slot.count());
  await slot.first().click();
  await page.waitForTimeout(3000);
  const t = await page.locator('body').innerText();
  console.log('AFTER SLOT TAP:', t.replace(/\n+/g, ' | ').slice(-1800));
  const btns = await page.locator('button').allInnerTexts();
  console.log('BUTTONS:', JSON.stringify(btns.filter(b => b && b.length < 60)));
  // If a Confirm/Confirmation button exists, click it.
  const confirm = page.getByRole('button', { name: /Confirm/ });
  console.log('CONFIRM COUNT:', await confirm.count());
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(3000);
    const t2 = await page.locator('body').innerText();
    console.log('AFTER CONFIRM:', t2.replace(/\n+/g, ' | ').slice(-1500));
  }
  // Show Orders table.
  const show = page.getByRole('button', { name: /Show Orders/ });
  if (await show.count()) {
    await show.first().click();
    await page.waitForTimeout(2500);
    const t3 = await page.locator('body').innerText();
    console.log('SHOW ORDERS TABLE:', t3.replace(/\n+/g, ' | ').slice(-1500));
  }
  await browser.close();
  console.log('SAVE PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
