// READ-ONLY probe: kitchen display, cash register, pending orders.
// Opens pages and dumps structure. Saves NOTHING. Never confirms
// Open/Close Register, never saves or pays a pending order.
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
  const heads = await page.locator('th').evaluateAll(els =>
    els.map(e => (e.innerText || '').trim()).filter(Boolean)).catch(() => []);
  if (heads.length) console.log('TABLE HEADERS:', heads.join(' | '));
  const links = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .filter(v => /kitchen|register|pending|order/i.test(v)).slice(0, 40)).catch(() => []);
  if (links.length) console.log('RELEVANT LINKS:\n' + links.join('\n'));
}

async function tryRoutes(page, routes, labelPrefix) {
  for (const r of routes) {
    await page.goto(r, { waitUntil: 'domcontentloaded' }).catch(e => console.log('GOTO ERR', r, e.message));
    await sleep(4500);
    const body = await page.locator('body').innerText().catch(() => '');
    const is404 = /404|not found|page not found/i.test(body.slice(0, 600));
    console.log(`\n--- ${labelPrefix} ${r} -> ${page.url()} ${is404 ? '[looks 404]' : ''} ---`);
    if (!is404) await dump(page, `${labelPrefix} ${r}`, 1500);
    else console.log('BODY HEAD:', body.slice(0, 300).replace(/\n+/g, ' | '));
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : (/Muse cafe/.test(homeText) ? '!!! MUSE CAFE — STOP' : 'workspace name not found in text'));
  if (/Muse cafe/.test(homeText) && !/Cafe muse2/.test(homeText)) { console.log('STOPPING: wrong workspace'); await browser.close(); process.exit(2); }
  console.log('HOME head:', homeText.slice(0, 500).replace(/\n+/g, ' | '));
  // Sidebar / nav links mentioning kitchen, register, pending
  const navLinks = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .filter(v => /kitchen|register|pending/i.test(v)).slice(0, 40)).catch(() => []);
  console.log('HOME RELEVANT LINKS:\n' + (navLinks.join('\n') || '(none)'));

  // ---- 1. KITCHEN DISPLAY ----
  await tryRoutes(page, [
    '/console/pos/dashboard/pos/kitchen/',
    '/kitchen-display/',
    '/kitchen-display-order/',
  ], 'KITCHEN');

  // ---- 2. CASH REGISTER ----
  await tryRoutes(page, [
    '/console/pos/dashboard/pos/cash-register/',
    '/register/',
    '/cash-register/',
  ], 'REGISTER');

  // If a register page loaded, look for Open/Close dialog triggers WITHOUT confirming.
  // (Only inspect: click Open Register if present, dump dialog, then Cancel/close it.)
  const openBtn = page.getByRole('button', { name: /open register/i }).first();
  if (await openBtn.count()) {
    console.log('\n--- Open Register button present; opening dialog for inspection only ---');
    await openBtn.click().catch(e => console.log('open click err', e.message));
    await sleep(2500);
    await dump(page, 'OPEN REGISTER DIALOG', 2500);
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); console.log('Dialog cancelled, no register opened.'); }
  } else {
    console.log('\n--- No "Open Register" button on current page (register may already be open) ---');
    const closeBtn = page.getByRole('button', { name: /close register/i }).first();
    console.log('Close Register button present:', await closeBtn.count() ? 'YES (not clicked)' : 'no');
  }

  // ---- 3. PENDING ORDERS ----
  await tryRoutes(page, [
    '/console/pos/dashboard/pos/pending-orders/',
    '/pending/',
  ], 'PENDING');

  // Also check the till for a Pending tab/button and Order Management for pending filter
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await dump(page, 'TILL (pending controls?)', 1200);
  await page.goto('/console/pos/dashboard/pos/order-management/', { waitUntil: 'domcontentloaded' });
  await sleep(4500);
  await dump(page, 'ORDER MANAGEMENT (pending controls?)', 1200);

  await browser.close();
  console.log('\nPROBE DONE — nothing saved, nothing opened/closed/paid.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
