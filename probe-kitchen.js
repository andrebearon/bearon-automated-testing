// Read-only probe: kitchen display board structure behind View Details.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/pos/kitchen-display/');
  await page.waitForTimeout(2500);
  console.log('PAGE TEXT HEAD:', (await page.locator('body').innerText()).slice(0, 900).replace(/\n+/g, ' | '));
  const view = page.getByRole('button', { name: /view details/i }).first();
  console.log('VIEW DETAILS COUNT:', await view.count());
  if (await view.count()) {
    await view.click();
    await page.waitForTimeout(4000);
    console.log('BOARD URL:', page.url());
    console.log('BOARD TEXT:', (await page.locator('body').innerText()).slice(0, 2000).replace(/\n+/g, ' | '));
    console.log('BOARD BUTTONS:', await page.locator('button').allInnerTexts().then(t => t.filter(x => x.trim()).slice(0, 40)));
    console.log('HAS CEE-51014:', await page.getByText('CEE-51014').count());
    console.log('HAS CEE-51015:', await page.getByText('CEE-51015').count());
  }
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
