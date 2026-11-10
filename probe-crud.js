// Read-only probe for the CRUD + sales/OM test design.
// Opens pages, dumps structure, saves NOTHING (form opened then closed).
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 1500) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, maxChars).replace(/\n+/g, ' | '));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 60)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} role=${e.getAttribute('role') || ''}`).slice(0, 50)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
  const tabs = await page.locator('[role="tab"]').evaluateAll(els =>
    els.map(e => (e.innerText || '').trim()).filter(Boolean)).catch(() => []);
  if (tabs.length) console.log('TABS:', tabs.join(' | '));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const homeText = await page.locator('body').innerText();
  console.log('HOME workspace check:', /Cafe muse2/.test(homeText) ? 'Cafe muse2 OK' : (/Muse cafe/.test(homeText) ? '!!! MUSE CAFE — STOP' : 'workspace name not found in text'));
  console.log('HOME head:', homeText.slice(0, 400).replace(/\n+/g, ' | '));

  // Categories page
  await page.goto('/console/pos/dashboard/inventory/categories/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dump(page, 'CATEGORIES PAGE', 800);

  // Products page + Add Product form
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dump(page, 'PRODUCTS LIST', 800);
  const add = page.getByRole('button', { name: /add product/i }).first();
  if (await add.count()) {
    await add.click();
    await sleep(3000);
    await dump(page, 'ADD PRODUCT FORM', 2500);
    // Tabs inside the form?
    const formTabs = await page.locator('[role="tab"]').allInnerTexts().catch(() => []);
    console.log('FORM TABS:', formTabs);
    // Close without saving
    const cancel = page.getByRole('button', { name: /cancel|close/i }).first();
    if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); }
  }

  // Order Management page
  await page.goto('/console/pos/dashboard/pos/order-management/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dump(page, 'ORDER MANAGEMENT', 1200);

  // Till page (order types / payment)
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await dump(page, 'TILL', 1200);

  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
