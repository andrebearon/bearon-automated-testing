const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/pos-settings/business-layout/');
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /Floor 1|Add Row|Remove Row/.test(e.textContent || ''));
    const floor = [...document.querySelectorAll('*')].find(e => e.textContent === 'Floor 1');
    let container = floor;
    for (let i = 0; i < 6 && container; i++) container = container.parentElement;
    return {
      leafTexts: els.map(e => e.textContent),
      containerHtml: container ? container.outerHTML.slice(0, 2500) : 'NONE',
      buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
