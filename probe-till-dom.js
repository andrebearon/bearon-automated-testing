// Diagnostic probe: dump the till (sales) page controls — is there a
// register selector, and what does the page show? No changes made.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(4000);
  const text = await page.locator('body').innerText();
  console.log('TILL TEXT (first 1500 chars):', text.replace(/\n+/g, ' | ').slice(0, 1500));
  const btns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].slice(0, 60).map(b => ({
      text: (b.innerText || '').trim().replace(/\n+/g, ' ').slice(0, 50),
      role: b.getAttribute('role') || 'button',
      visible: b.offsetParent !== null,
    })).filter(b => b.text);
  });
  console.log('BUTTONS:', JSON.stringify(btns, null, 0));
  await browser.close();
  console.log('PROBE DONE (no changes made)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
