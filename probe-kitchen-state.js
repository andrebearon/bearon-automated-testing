// State check after the kitchen spec's exec session was lost mid-run.
// Reads: kitchen-tickets switch state, OM for the kitchen product, and
// the board. If tickets are still ON, turns them OFF (restore workspace).
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  // 1. Tickets state.
  await page.goto('https://bearon.studio/console/settings/features/pos/');
  await page.locator('[role="switch"]').first().waitFor({ timeout: 30000 });
  const st = await page.evaluate(() => {
    const switches = [...document.querySelectorAll('[role="switch"]')];
    for (let i = 0; i < switches.length; i++) {
      let el = switches[i];
      for (let up = 0; up < 5 && el; up++) {
        if (el.innerText && el.innerText.includes('Show orders on a kitchen screen')) {
          return { index: i, checked: switches[i].getAttribute('aria-checked') === 'true' };
        }
        el = el.parentElement;
      }
    }
    return null;
  });
  console.log('KITCHEN TICKETS STATE:', JSON.stringify(st));
  if (st && st.checked) {
    await page.locator('[role="switch"]').nth(st.index).click();
    await page.waitForTimeout(2000);
    console.log('KITCHEN TICKETS RESTORED TO OFF');
  }
  // 2. Did the kitchen product get created / sold?
  await page.goto('/console/pos/dashboard/inventory/products/');
  await page.getByPlaceholder(/search products/i).first().fill('Kitchen Prod 82612517');
  await page.waitForTimeout(2000);
  console.log('KITCHEN PRODUCT IN LIST:', await page.getByText('Kitchen Prod 82612517', { exact: true }).count());
  await page.goto('/console/pos/dashboard/pos/order-management/');
  const search = page.getByPlaceholder(/search orders by refno/i).first();
  await search.fill('Kitchen Prod');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  console.log('OM BODY HAS Kitchen Prod:', (await page.locator('body').innerText()).includes('Kitchen Prod 82612517'));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
