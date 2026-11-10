// Read-only probe D: POS Setup / business layout (tables/slots/floors).
// Opens pages, dumps links. Saves NOTHING.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function dump(page, label, maxChars = 2000) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, maxChars).replace(/\n+/g, ' | '));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 60)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
  const links = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`)
      .filter((v, i, arr) => arr.indexOf(v) === i)).catch(() => []);
  console.log('LINKS:\n' + links.join('\n'));
}
(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : '!!! CHECK WORKSPACE');
  await page.goto('/console/pos/dashboard/pos/pos-settings/', { waitUntil: 'domcontentloaded' });
  await sleep(4500);
  await dump(page, 'POS SETTINGS', 2500);
  const settingsLinks = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`)
      .filter((v, i, arr) => arr.indexOf(v) === i)).catch(() => []);
  const layoutLinks = settingsLinks.filter(l => /layout|table|floor|slot|seat/i.test(l));
  console.log('LAYOUT-LIKE LINKS:\n' + (layoutLinks.join('\n') || '(none)'));
  const candidates = [
    ...new Set(layoutLinks.map(l => l.split(' | ')[0])),
    '/console/pos/dashboard/pos/pos-settings/business-layout/',
    '/console/pos/dashboard/pos/pos-settings/table-layout/',
    '/console/pos/dashboard/pos/pos-settings/layout/',
    '/console/pos/dashboard/pos/pos-settings/tables/',
    '/console/pos/dashboard/pos/pos-settings/floors/',
  ].filter(Boolean);
  for (const r of candidates) {
    await page.goto(r, { waitUntil: 'domcontentloaded' });
    await sleep(4000);
    const t = await page.locator('body').innerText().catch(() => '');
    const is404 = /404|not found|page not found/i.test(t.slice(0, 500));
    console.log(`\nLAYOUT TRY ${r} -> ${page.url()} 404-ish=${is404} head=${t.slice(0, 200).replace(/\n+/g, ' | ')}`);
    if (!is404 && /layout|floor|table|slot/i.test(t)) { await dump(page, 'LAYOUT PAGE ' + r, 2500); break; }
  }
  await browser.close();
  console.log('\nPROBE D DONE — nothing saved.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
