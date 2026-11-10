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
  const body = await page.locator('body').innerText();
  console.log('=== TILL (first 1500) ===');
  console.log(body.slice(0, 1500));
  console.log('REGISTER MENTIONS:', [...body.matchAll(/Reg CRUD 84807789U|Default/g)].length, 'Default count:', (body.match(/Default/g) || []).length);
  // Look for a register selector: buttons/selects containing 'Default' or 'Register'.
  const cands = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, select').forEach(el => {
      const t = (el.innerText || el.value || '').trim();
      if (/register|default/i.test(t)) out.push({ tag: el.tagName, text: t.slice(0, 80), aria: el.getAttribute('aria-label') });
    });
    return out;
  });
  console.log('REGISTER CONTROLS:', JSON.stringify(cands, null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
