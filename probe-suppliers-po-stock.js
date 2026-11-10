// Read-only probe: Suppliers, Purchase Orders, Manage Stock.
// Opens pages, dumps structure, saves NOTHING (forms opened then cancelled/closed).
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 1500) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, maxChars).replace(/\n+/g, ' | '));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 80)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} role=${e.getAttribute('role') || ''} aria-label=${e.getAttribute('aria-label') || ''}`).slice(0, 60)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
  const tabs = await page.locator('[role="tab"]').evaluateAll(els =>
    els.map(e => (e.innerText || '').trim()).filter(Boolean)).catch(() => []);
  if (tabs.length) console.log('TABS:', tabs.join(' | '));
  const links = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 80)).catch(() => []);
  console.log('LINKS:\n' + links.join('\n'));
  const ths = await page.locator('th').evaluateAll(els => els.map(e => (e.innerText || '').trim()).filter(Boolean)).catch(() => []);
  if (ths.length) console.log('TABLE HEADERS:', ths.join(' | '));
  // delete-ish controls visible
  const del = await page.locator('button, a').evaluateAll(els =>
    els.map(e => (e.innerText || '').trim()).filter(t => /delete|remove|trash/i.test(t)).filter((v, i, a) => a.indexOf(v) === i)).catch(() => []);
  console.log('DELETE-LIKE TEXT BUTTONS:', del.length ? del.join(' | ') : '(none)');
}

async function gotoDump(page, route, label, maxChars = 1500) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dump(page, label, maxChars);
  const body = await page.locator('body').innerText().catch(() => '');
  return { url: page.url(), body };
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : (/Muse cafe/.test(homeText) ? '!!! MUSE CAFE — STOP' : 'workspace name not found in text'));
  console.log('HOME head:', homeText.slice(0, 300).replace(/\n+/g, ' | '));
  if (/Muse cafe/.test(homeText) && !/Cafe muse2/.test(homeText)) { await browser.close(); return; }

  // 0. Inventory overview — harvest supplier/PO/stock links
  await gotoDump(page, '/console/pos/dashboard/inventory/overview/', 'INVENTORY OVERVIEW', 1000);
  const invLinks = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`).filter((v, i, arr) => arr.indexOf(v) === i)).catch(() => []);
  console.log('INV LINKS FILTERED (supplier|purchase|stock):\n' + invLinks.filter(l => /supplier|purchase|stock/i.test(l)).join('\n'));

  // ===== 1. SUPPLIERS =====
  const sup = await gotoDump(page, '/console/pos/dashboard/inventory/suppliers/', 'SUPPLIERS LIST (guessed route)', 2000);
  console.log('SUPPLIER route 404-ish?', /404|not found|page not found/i.test(sup.body.slice(0, 500)) ? 'YES?' : 'no');
  // Try Add/Create Supplier button
  let addSup = page.getByRole('button', { name: /add supplier|create supplier|new supplier/i }).first();
  if (await addSup.count()) {
    console.log('CLICKING Add Supplier...');
    await addSup.click();
    await sleep(3000);
    await dump(page, 'ADD SUPPLIER FORM', 2500);
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); console.log('After cancel, URL:', page.url()); }
  } else {
    console.log('NO Add/Create Supplier button found on suppliers page.');
    // maybe it's a link
    const addLink = page.getByRole('link', { name: /add supplier|create supplier|new supplier/i }).first();
    if (await addLink.count()) { console.log('Found Add Supplier LINK, clicking...'); await addLink.click(); await sleep(3000); await dump(page, 'ADD SUPPLIER FORM (via link)', 2500); const c = page.getByRole('button', { name: /cancel|close/i }).first(); if (await c.count()) { await c.click().catch(() => {}); await sleep(1500); } }
  }
  // Row kebab / row click: dump first row buttons
  const rowBtns = await page.locator('table tbody tr').first().locator('button').evaluateAll(els => els.map(b => (b.innerText || '').trim() || (b.getAttribute('aria-label') || '')).filter(Boolean)).catch(() => []);
  console.log('FIRST SUPPLIER ROW BUTTONS:', rowBtns.join(' | ') || '(none / no rows)');

  // ===== 2. PURCHASE ORDERS =====
  for (const r of ['/console/pos/dashboard/inventory/purchase-orders/', '/console/pos/dashboard/inventory/purchase_orders/']) {
    const res = await gotoDump(page, r, 'PO LIST ' + r, 2000);
    console.log('PO route 404-ish?', /404|not found|page not found/i.test(res.body.slice(0, 500)) ? 'YES?' : 'no');
    if (!/404|not found/i.test(res.body.slice(0, 500)) && /purchase/i.test(res.body.slice(0, 1000))) break;
  }
  let addPO = page.getByRole('button', { name: /create purchase order|new purchase order|add purchase order|create po/i }).first();
  if (await addPO.count()) {
    console.log('CLICKING Create PO...');
    await addPO.click();
    await sleep(3000);
    await dump(page, 'CREATE PO FORM', 3000);
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); console.log('After cancel, URL:', page.url()); }
  } else {
    console.log('NO Create PO button found on PO page.');
    const addLink = page.getByRole('link', { name: /create purchase order|new purchase order/i }).first();
    if (await addLink.count()) { console.log('Found Create PO LINK, clicking...'); await addLink.click(); await sleep(3000); await dump(page, 'CREATE PO FORM (via link)', 3000); const c = page.getByRole('button', { name: /cancel|close/i }).first(); if (await c.count()) { await c.click().catch(() => {}); await sleep(1500); } }
  }
  const poRowBtns = await page.locator('table tbody tr').first().locator('button').evaluateAll(els => els.map(b => (b.innerText || '').trim() || (b.getAttribute('aria-label') || '')).filter(Boolean)).catch(() => []);
  console.log('FIRST PO ROW BUTTONS:', poRowBtns.join(' | ') || '(none / no rows)');
  // Receive / status controls on list
  const poBody = await page.locator('body').innerText().catch(() => '');
  console.log('PO page mentions Receive/status?:', /receive|received|pending|approved|draft/i.test(poBody) ? poBody.match(/receiv\w+|pending|approved|draft/gi).slice(0, 10).join(', ') : '(none)');

  // ===== 3. MANAGE STOCK =====
  for (const r of ['/console/pos/dashboard/inventory/stocks/', '/console/pos/dashboard/inventory/manage-stocks/', '/console/pos/dashboard/inventory/stock/']) {
    const res = await gotoDump(page, r, 'STOCK LIST ' + r, 2000);
    console.log('STOCK route 404-ish?', /404|not found|page not found/i.test(res.body.slice(0, 500)) ? 'YES?' : 'no');
    if (!/404|not found/i.test(res.body.slice(0, 500)) && /stock/i.test(res.body.slice(0, 1000))) break;
  }
  // Try stock adjustment / add stock button
  let adjBtn = page.getByRole('button', { name: /adjust stock|stock adjustment|add stock|manage stock|create adjustment/i }).first();
  if (await adjBtn.count()) {
    console.log('CLICKING stock button:', await adjBtn.innerText().catch(() => '?'));
    await adjBtn.click();
    await sleep(3000);
    await dump(page, 'STOCK ADJUSTMENT FORM', 3000);
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); console.log('After cancel, URL:', page.url()); }
  } else {
    console.log('NO stock-adjustment button found; trying first row click / detail link...');
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.count()) {
      await firstRow.click().catch(() => {});
      await sleep(3000);
      await dump(page, 'STOCK ROW CLICK RESULT', 2500);
    } else console.log('No table rows on stock page.');
  }
  const stockRowBtns = await page.locator('table tbody tr').first().locator('button').evaluateAll(els => els.map(b => (b.innerText || '').trim() || (b.getAttribute('aria-label') || '')).filter(Boolean)).catch(() => []);
  console.log('FIRST STOCK ROW BUTTONS:', stockRowBtns.join(' | ') || '(none / no rows)');

  await browser.close();
  console.log('\nPROBE DONE — nothing saved.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
