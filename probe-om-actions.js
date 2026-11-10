const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  // Paid order details: what action buttons exist? (CEE-51014 was reported
  // as having NO void control in scenario 7a; CEE-51017 is another Paid one.)
  for (const ref of ['CEE-51014', 'CEE-51017']) {
    await h.openOrderDetails(page, ref);
    await page.waitForTimeout(2500);
    const btns = await page.getByRole('button').allInnerTexts();
    console.log(`=== ${ref} BUTTONS ===`);
    console.log(JSON.stringify(btns.filter(t => t.trim())));
    const body = await page.locator('body').innerText();
    console.log('STATUS LINE:', (body.match(/Paid|Voided|Refunded|Cancelled|Pending/g) || []).slice(0, 6).join(','));
  }
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
