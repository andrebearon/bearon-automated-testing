// Probe fix-1e: open the saved product "CRUD Prod 70592238" (created by
// the fix-crud run; its spec failed before cleanup) on the details page,
// Options tab — dump body text + inputs to see how the saved group name
// and values render (input values vs visible text). Read-only.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await h.openProductDetails(page, 'CRUD Prod 70592238');
  await sleep(1500);
  console.log('=== GENERAL TAB inputs ===');
  console.log(JSON.stringify(await page.locator('input').evaluateAll(els => els.map(e => ({ ph: e.getAttribute('placeholder'), val: e.value, name: e.getAttribute('name') }))), null, 1));
  await page.getByRole('tab', { name: /options/i }).click();
  await sleep(2000);
  const body = await page.locator('body').innerText();
  const idx = body.indexOf('Options');
  console.log('=== OPTIONS TAB BODY (from 2nd Options) ===\n' + body.slice(body.indexOf('Stock per combination') - 1500));
  console.log('=== OPTIONS TAB inputs ===');
  console.log(JSON.stringify(await page.locator('input').evaluateAll(els => els.map(e => ({ ph: e.getAttribute('placeholder'), val: e.value }))), null, 1));
  console.log('SWITCH checked:', await page.locator('#trackVariantStock').getAttribute('aria-checked').catch(() => 'no switch'));
  console.log('HAS TEXT Size:', /Size/.test(body), '| Regular:', /Regular/.test(body), '| Large:', /Large/.test(body));
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await sleep(1500);
  const body2 = await page.locator('body').innerText();
  console.log('=== ADD-ONS TAB: has Extras:', /Extras/.test(body2), '| Extra Cheese:', /Extra Cheese/.test(body2));
  console.log('=== ADD-ONS inputs ===');
  console.log(JSON.stringify(await page.locator('input').evaluateAll(els => els.map(e => ({ ph: e.getAttribute('placeholder'), val: e.value }))), null, 1));
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
