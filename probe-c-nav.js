// Read-only probe C: nav map, business layout/slots, customers/CRM, till pending-order.
// Opens forms and closes WITHOUT saving. No creates/edits/deletes.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 2000) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, maxChars).replace(/\n+/g, ' | '));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 80)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} aria=${e.getAttribute('aria-label') || ''}`).slice(0, 60)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
  const tabs = await page.locator('[role="tab"]').evaluateAll(els =>
    els.map(e => (e.innerText || '').trim()).filter(Boolean)).catch(() => []);
  if (tabs.length) console.log('TABS:', tabs.join(' | '));
  const links = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 80)}`).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 120)).catch(() => []);
  console.log('LINKS:\n' + links.join('\n'));
}

async function wsCheck(page, label) {
  const t = await page.locator('body').innerText().catch(() => '');
  if (/Muse cafe/.test(t) && !/Cafe muse2/.test(t)) { console.log(`!!! ${label}: MUSE CAFE DETECTED — STOPPING`); process.exit(2); }
  console.log(`${label} workspace:`, /Cafe muse2/.test(t) ? 'Cafe muse2 OK' : 'name not found in body text');
  return t;
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // 1. HOME / NAVIGATION
  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await wsCheck(page, 'HOME');
  await dump(page, 'HOME /console (nav map + cards)', 2500);

  // Collect nav links mentioning key areas
  const navLinks = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim() }))
      .filter(x => x.href && x.text)).catch(() => []);
  const keywords = ['supplier', 'purchase', 'stock', 'kitchen', 'register', 'pending', 'layout', 'customer', 'crm', 'slot', 'table', 'floor'];
  console.log('\n--- KEYWORD NAV LINKS ---');
  for (const l of navLinks) if (keywords.some(k => (l.href + ' ' + l.text).toLowerCase().includes(k))) console.log(`${l.href} | ${l.text}`);
  const findLink = (re) => { const m = navLinks.find(l => re.test(l.href) || re.test(l.text)); return m ? m.href : null; };

  // 2. BUSINESS LAYOUT / SLOTS
  const layoutCandidates = [
    findLink(/business-layout/i),
    '/console/pos/dashboard/settings/business-layout/',
    '/console/pos/dashboard/business-layout/',
    '/console/pos/dashboard/layout/',
    '/console/pos/dashboard/settings/layout/',
  ].filter(Boolean);
  console.log('\nLAYOUT CANDIDATES:', [...new Set(layoutCandidates)].join(' | '));
  let layoutUrl = null;
  for (const route of [...new Set(layoutCandidates)]) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await sleep(4000);
    const t = await page.locator('body').innerText().catch(() => '');
    const is404 = /404|not found|page not found/i.test(t.slice(0, 500));
    console.log(`\nLAYOUT TRY ${route} -> ${page.url()} 404-ish=${is404} bodyHead=${t.slice(0, 200).replace(/\n+/g, ' | ')}`);
    if (!is404 && /layout|floor|table|slot/i.test(t)) { layoutUrl = page.url(); await dump(page, 'BUSINESS LAYOUT PAGE', 2500); break; }
  }
  if (layoutUrl) {
    // Try Add/Create slot/floor/table form, close without saving
    const addBtn = page.getByRole('button', { name: /add (slot|table|floor)|create (slot|table|floor)|new (slot|table|floor)|add/i }).first();
    if (await addBtn.count()) {
      console.log('LAYOUT ADD BTN:', (await addBtn.innerText().catch(() => '')).trim());
      await addBtn.click().catch(() => {});
      await sleep(2500);
      await dump(page, 'LAYOUT ADD FORM (unsaved)', 2500);
      const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
      if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); }
      else await page.keyboard.press('Escape').catch(() => {});
    } else console.log('LAYOUT: no Add button found by role query');
    // Edit/Delete controls present?
    const editCount = await page.getByRole('button', { name: /^edit$/i }).count().catch(() => 0);
    const delCount = await page.getByRole('button', { name: /delete|remove/i }).count().catch(() => 0);
    console.log(`LAYOUT Edit buttons=${editCount} Delete/Remove buttons=${delCount}`);
    const kebab = await page.locator('button[aria-label*="more" i], button[aria-label*="action" i]').count().catch(() => 0);
    console.log('LAYOUT kebab/action buttons=', kebab);
  } else console.log('LAYOUT: no working route found among candidates');

  // 3. CUSTOMERS / CRM
  const custCandidates = [
    findLink(/customer/i),
    '/console/pos/dashboard/customers/',
    '/console/pos/dashboard/crm/',
    '/console/pos/dashboard/customers/list/',
    '/console/customers/',
  ].filter(Boolean);
  console.log('\nCUSTOMER CANDIDATES:', [...new Set(custCandidates)].join(' | '));
  let custUrl = null;
  for (const route of [...new Set(custCandidates)]) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await sleep(4000);
    const t = await page.locator('body').innerText().catch(() => '');
    const is404 = /404|not found|page not found/i.test(t.slice(0, 500));
    console.log(`\nCUSTOMER TRY ${route} -> ${page.url()} 404-ish=${is404} bodyHead=${t.slice(0, 200).replace(/\n+/g, ' | ')}`);
    if (!is404 && /customer/i.test(t)) { custUrl = page.url(); await dump(page, 'CUSTOMERS LIST PAGE', 2500); break; }
  }
  if (custUrl) {
    const bodyTxt = await page.locator('body').innerText().catch(() => '');
    console.log('CUSTOMER duplicate-phone text visible?', /duplicate|already exists|phone.*exist|exist.*phone/i.test(bodyTxt) ? 'YES (quote in body above)' : 'NO mention in list body');
    // Add Customer form, close without saving
    const addC = page.getByRole('button', { name: /add customer|new customer|create customer/i }).first();
    if (await addC.count()) {
      console.log('ADD CUSTOMER BTN:', (await addC.innerText().catch(() => '')).trim());
      await addC.click().catch(() => {});
      await sleep(2500);
      await dump(page, 'ADD CUSTOMER FORM (unsaved)', 3000);
      const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
      if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); }
      else await page.keyboard.press('Escape').catch(() => {});
    } else console.log('CUSTOMERS: no Add Customer button found');
    // Open first existing customer detail (read-only)
    const rowLink = page.locator('a[href*="customer"]').first();
    const rowCount = await page.locator('table tbody tr').count().catch(() => 0);
    console.log('CUSTOMER table rows=', rowCount, 'customer href links=', await page.locator('a[href*="customer"]').count().catch(() => 0));
    if (rowCount > 0) {
      await page.locator('table tbody tr').first().click().catch(() => {});
      await sleep(3000);
      console.log('AFTER ROW CLICK URL:', page.url());
      await dump(page, 'CUSTOMER DETAIL (read-only)', 2500);
    } else if (await rowLink.count()) {
      await rowLink.first().click().catch(() => {});
      await sleep(3000);
      await dump(page, 'CUSTOMER DETAIL via link (read-only)', 2500);
    } else console.log('CUSTOMERS: no rows/links to open a detail');
  } else console.log('CUSTOMERS: no working route found among candidates');

  // 4. TILL PENDING-ORDER SAVE
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await wsCheck(page, 'TILL');
  await dump(page, 'TILL (pending-order buttons)', 2000);
  const pendBtn = page.getByRole('button', { name: /pending|save.*pending|hold/i }).first();
  console.log('TILL pending button count=', await page.getByRole('button', { name: /pending|save.*pending|hold/i }).count().catch(() => 0));
  if (await pendBtn.count()) {
    console.log('TILL PENDING BTN:', (await pendBtn.innerText().catch(() => '')).trim());
    await pendBtn.click().catch(() => {});
    await sleep(2500);
    await dump(page, 'TILL AFTER PENDING CLICK (slot-picker?)', 2500);
    // Close dialog without saving: Cancel/Close/Escape only, never confirm
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1200); }
    else await page.keyboard.press('Escape').catch(() => {});
    console.log('TILL after close URL:', page.url());
  } else console.log('TILL: no Pending/Hold button found by role query');

  await browser.close();
  console.log('\nPROBE C DONE — nothing saved.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
