const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await h.openOrderDetails(page, 'CEE-51017');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Update Status' }).click();
  await page.waitForTimeout(1500);
  const html = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => e.textContent && e.textContent.includes('Update Order Status') && e.textContent.length < 800);
    const el = els[els.length - 1];
    return el ? el.outerHTML.slice(0, 2500) : 'NOT FOUND';
  });
  console.log('DIALOG HTML:', html);
  await page.keyboard.press('Escape');
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
