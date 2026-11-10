// Probe fix-1b: dump the Options tab DOM in detail — all inputs
// (placeholder/value), all elements mentioning generate/combination/stock,
// and the "Stock per combination" section HTML. Does NOT save.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/inventory/products/');
  await page.getByRole('button', { name: 'Add Product' }).click();
  await sleep(3000);
  await h.fillProductGeneral(page, { name: 'Probe Prod X', category: 'Auto Category', price: 10000, description: 'probe only' });
  await h.fillProductOptions(page, { group: 'Size', values: [{ name: 'Regular', charge: 0 }, { name: 'Large', charge: 5000 }] });
  await sleep(1500);
  const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({
    ph: e.getAttribute('placeholder'), val: e.value, type: e.type, name: e.getAttribute('name'), disabled: e.disabled,
  })));
  console.log('INPUTS:', JSON.stringify(inputs, null, 1));
  // Every element whose text mentions generate/combination/stock per combination
  const hits = await page.locator('body *').evaluateAll(els => els
    .filter(e => /generate|combination/i.test(e.textContent || '') && (e.textContent || '').length < 300)
    .map(e => `${e.tagName}.${(e.className && e.className.baseVal === undefined ? String(e.className).slice(0, 80) : '')} role=${e.getAttribute('role')} :: ${(e.textContent || '').trim().slice(0, 200)}`));
  console.log('GENERATE/COMBINATION ELEMENTS:', JSON.stringify([...new Set(hits)], null, 1));
  // All clickable-ish elements in the tab panel (buttons, [role=button], links, elements with cursor pointer / onclick)
  const clickables = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, [role="button"], a, summary, [tabindex="0"]').forEach(e => {
      const t = (e.innerText || e.textContent || '').trim().replace(/\n+/g, ' ').slice(0, 120);
      if (t) out.push(`${e.tagName} :: ${t}`);
    });
    return out;
  });
  console.log('CLICKABLES:', JSON.stringify(clickables, null, 1));
  // Dump the section containing "Stock per combination" outerHTML
  const sectionHtml = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /Stock per combination/.test(e.textContent || ''));
    if (!els.length) return 'NOT FOUND';
    let n = els[0];
    for (let i = 0; i < 4 && n.parentElement; i++) n = n.parentElement;
    return n.outerHTML.slice(0, 6000);
  });
  console.log('STOCK-PER-COMBINATION SECTION HTML:\n' + sectionHtml);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
