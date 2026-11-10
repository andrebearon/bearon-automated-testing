// Probe 4: (a) Add Product form — list tabs, look for a Track Inventory /
// stock switch on the General tab (needed to test PO receive stock effect
// in scenario 5); (b) PO details for Received probe PO #051168001 —
// Update Status dialog: click the Status button, dump the status options,
// then Cancel without changing anything.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);

  // ---- (a) Product form tabs + inventory tracking ----
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: 'Add Product' }).click();
  await sleep(3000);
  const tabs = await page.getByRole('tab').allInnerTexts().catch(() => []);
  console.log('PRODUCT FORM TABS:', JSON.stringify(tabs));
  const bodyA = await page.locator('body').innerText();
  console.log('TRACK INVENTORY text count:', (bodyA.match(/track inventory/gi) || []).length, '| TRACK STOCK:', (bodyA.match(/track stock/gi) || []).length, '| STOCK:', (bodyA.match(/stock/gi) || []).length);
  // Dump switches/checkboxes on the General tab
  const switches = await page.locator('[role="switch"], input[type="checkbox"]').evaluateAll(els =>
    els.map(e => `id=${e.id || ''} name=${e.getAttribute('name') || ''} aria-checked=${e.getAttribute('aria-checked') || ''} checked=${e.checked} label=${(e.closest('label')?.innerText || e.parentElement?.innerText || '').slice(0, 80)}`).slice(0, 20)).catch(() => []);
  console.log('GENERAL TAB SWITCHES/CHECKBOXES:\n' + switches.join('\n'));
  // Look for an Inventory tab specifically
  const invTab = page.getByRole('tab', { name: /inventory|stock/i }).first();
  console.log('INVENTORY/STOCK TAB COUNT:', await invTab.count());
  if (await invTab.count()) {
    await invTab.click();
    await sleep(2000);
    console.log('INVENTORY TAB BODY:', (await page.locator('body').innerText()).slice(0, 2000).replace(/\n+/g, ' | '));
    const sw2 = await page.locator('[role="switch"], input[type="checkbox"]').evaluateAll(els =>
      els.map(e => `id=${e.id || ''} name=${e.getAttribute('name') || ''} aria-checked=${e.getAttribute('aria-checked') || ''} label=${(e.closest('label')?.innerText || e.parentElement?.innerText || '').slice(0, 80)}`).slice(0, 20)).catch(() => []);
    console.log('INVENTORY TAB SWITCHES:\n' + sw2.join('\n'));
  }

  // ---- (b) PO Update Status options on the Received probe PO ----
  await page.goto('/console/pos/dashboard/inventory/purchase-orders/details/?purchaseOrderId=28', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  console.log('PO DETAILS STATUS NOW:', (await page.locator('body').innerText()).match(/Status\s*\|\s*\w+/)?.[0]);
  await page.getByRole('button', { name: /update status/i }).first().click();
  await sleep(2000);
  const statusBtn = page.locator('button', { hasText: 'Received' }).first();
  console.log('STATUS BUTTON COUNT:', await statusBtn.count());
  if (await statusBtn.count()) {
    await statusBtn.click();
    await sleep(2000);
    const opts = await page.getByRole('option').allInnerTexts().catch(() => []);
    console.log('STATUS OPTIONS (role=option):', JSON.stringify(opts));
    console.log('STATUS DIALOG BODY:', (await page.locator('body').innerText()).slice(-1500).replace(/\n+/g, ' | '));
    await page.keyboard.press('Escape');
    await sleep(800);
  }
  const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
  if (await cancelBtn.count()) { await cancelBtn.click(); await sleep(1200); }
  console.log('AFTER CANCEL, STATUS STILL:', (await page.locator('body').innerText()).match(/Status \| \w+/)?.[0] || 'unknown');
  console.log('\nPROBE4 DONE');
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
