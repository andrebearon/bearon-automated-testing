const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/pos/kitchen-display/display/?locationId=54&screenId=6');
  await page.waitForTimeout(4000);
  const body = await page.locator('body').innerText();
  console.log('BOARD HAS Kitchen Prod:', body.includes('Kitchen Prod'));
  console.log('BOARD COLUMNS:', (body.match(/(Not started|In Progress|Ready to Serve|Completed Orders|Cancelled Orders) \(\d+\)/g) || []).join(', '));
  console.log('BOARD SNIPPET:', body.slice(body.indexOf('Not started'), body.indexOf('Not started') + 500).replace(/\n+/g, ' | '));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
