// Read-only probe: list links on inventory pages to find the product list route.
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  for (const route of ['/console/pos/dashboard/inventory/overview/', '/console/pos/dashboard/inventory/']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    console.log('\n===', page.url());
    const links = await page.locator('a[href]').evaluateAll(els =>
      els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 80)}`).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 60));
    console.log(links.join('\n'));
    const buttons = await page.locator('button').evaluateAll(els =>
      els.map(b => (b.innerText || '').trim()).filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 40));
    console.log('BUTTONS:', buttons.join(' | '));
  }
  await browser.close();
})();
