// READ-ONLY probe round 2: kitchen-display route, register detail/logs,
// pending-order discovery. Saves NOTHING. Never confirms Open/Close
// Register, never saves/pays anything.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 2500) {
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
      .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 80)).catch(() => []);
  console.log('ALL LINKS:\n' + links.join('\n'));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : '!!! WORKSPACE PROBLEM');
  if (/Muse cafe/.test(homeText) && !/Cafe muse2/.test(homeText)) { console.log('STOPPING: wrong workspace'); await browser.close(); process.exit(2); }

  // ---- 1. KITCHEN DISPLAY (real route from home nav) ----
  await page.goto('/console/pos/dashboard/pos/kitchen-display/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await dump(page, 'KITCHEN DISPLAY', 3000);
  // Order cards: look for status columns / card text
  const cards = await page.locator('body').innerText().catch(() => '');
  console.log('KITCHEN keyword scan:', ['New', 'Preparing', 'Ready', 'Completed', 'Start Preparing', 'Mark Ready', 'Mark Completed', 'Reopen', 'CEE-'].map(k => `${k}:${cards.includes(k) ? 'YES' : 'no'}`).join(' '));

  // ---- 2. REGISTER DETAIL + LOGS ----
  await page.goto('/console/pos/dashboard/pos/cash-register/', { waitUntil: 'domcontentloaded' });
  await sleep(4500);
  // Manage button on the Default row
  const manage = page.getByRole('button', { name: /^manage$/i }).first();
  console.log('\nManage button count:', await manage.count());
  if (await manage.count()) {
    await manage.click().catch(e => console.log('manage click err', e.message));
    await sleep(3000);
    await dump(page, 'REGISTER MANAGE / DETAIL', 3000);
    const regBody = await page.locator('body').innerText().catch(() => '');
    console.log('REGISTER keyword scan:', ['Opening Float', 'Expected Cash', 'Counted', 'Variance', 'Cash Sales', 'Total Orders', 'Open session', 'Close session', 'Opening float', 'Expected'].map(k => `${k}:${regBody.includes(k) ? 'YES' : 'no'}`).join(' '));
    // Try opening the Close session dialog for inspection only, then cancel.
    const closeSess = page.getByRole('button', { name: /close session/i }).first();
    console.log('Close session button count on detail page:', await closeSess.count());
    if (await closeSess.count()) {
      await closeSess.click().catch(e => console.log('close click err', e.message));
      await sleep(2500);
      await dump(page, 'CLOSE SESSION DIALOG (inspect only)', 2500);
      const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
      if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); console.log('Close dialog cancelled — register NOT closed.'); }
    }
  }
  // All Logs
  await page.goto('/console/pos/dashboard/pos/cash-register/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const logs = page.getByRole('button', { name: /all logs/i }).first();
  console.log('\nAll Logs button count:', await logs.count());
  if (await logs.count()) {
    await logs.click().catch(e => console.log('logs click err', e.message));
    await sleep(3000);
    await dump(page, 'REGISTER ALL LOGS', 2500);
  }

  // ---- 3. PENDING ORDERS discovery ----
  // POS overview sidebar: dump all links
  await page.goto('/console/pos/dashboard/pos/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  console.log('\n===== POS OVERVIEW LINKS =====');
  console.log('URL:', page.url());
  const posLinks = await page.locator('a[href]').evaluateAll(els =>
    els.map(a => `${a.getAttribute('href')} | ${(a.innerText || '').trim().slice(0, 60)}`)
      .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 100)).catch(() => []);
  console.log(posLinks.join('\n'));
  // Try more pending routes
  for (const r of ['/console/pos/dashboard/pos/pending/', '/console/pos/dashboard/pos/orders/', '/console/pos/dashboard/pos/orders/pending/']) {
    await page.goto(r, { waitUntil: 'domcontentloaded' }).catch(e => console.log('GOTO ERR', r, e.message));
    await sleep(4000);
    const b = await page.locator('body').innerText().catch(() => '');
    console.log(`\n--- PENDING TRY ${r} -> ${page.url()} ${/404|not found/i.test(b.slice(0, 400)) ? '[404]' : ''} ---`);
    console.log('HEAD:', b.slice(0, 500).replace(/\n+/g, ' | '));
  }
  // Console global search for "pending"
  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const search = page.locator('input[placeholder*="Search the console"], input[placeholder*="Quick search"]').first();
  console.log('\nConsole search input count:', await search.count());
  if (await search.count()) {
    await search.click().catch(() => {});
    await search.fill('pending').catch(e => console.log('search fill err', e.message));
    await sleep(2500);
    const sb = await page.locator('body').innerText().catch(() => '');
    console.log('SEARCH "pending" results head:', sb.slice(0, 1200).replace(/\n+/g, ' | '));
    await page.keyboard.press('Escape').catch(() => {});
  }

  await browser.close();
  console.log('\nPROBE ROUND 2 DONE — nothing saved, nothing opened/closed/paid.');
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
