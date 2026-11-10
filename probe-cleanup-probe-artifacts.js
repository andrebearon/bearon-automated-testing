// Cleanup for probe artifacts only: delete probe PO #051168001 (Received)
// via its list-row kebab menu, then delete probe supplier
// "Probe Sup 71149573" via its list-row kebab menu. Verifies each is gone
// from search afterwards. Nothing else is touched.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

async function kebabDelete(page, { listUrl, searchTerm, label }) {
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.count()) { await search.fill(searchTerm); await sleep(2000); }
  const row = page.locator('tr', { hasText: searchTerm }).first();
  if (!(await row.count())) { console.log(`NOT FOUND (already gone?): ${label}`); return false; }
  const kebab = row.locator('button').nth(1);
  await kebab.click();
  await sleep(1500);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await page.getByText('Delete', { exact: true }).last().click();
  }
  await sleep(1500);
  const confirm = page.getByRole('button', { name: /^delete$/i }).first();
  if (await confirm.count()) { await confirm.click(); await sleep(2000); }
  // Verify gone
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const s2 = page.getByPlaceholder(/search/i).first();
  if (await s2.count()) { await s2.fill(searchTerm); await sleep(2000); }
  const gone = (await page.getByText(searchTerm, { exact: true }).count()) === 0;
  console.log(`${gone ? 'DELETED OK' : 'STILL PRESENT'}: ${label}`);
  return gone;
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await kebabDelete(page, {
    listUrl: '/console/pos/dashboard/inventory/purchase-orders/',
    searchTerm: '051168001', label: 'probe PO #051168001',
  });
  await kebabDelete(page, {
    listUrl: '/console/pos/dashboard/inventory/suppliers/',
    searchTerm: 'Probe Sup 71149573', label: 'probe supplier Probe Sup 71149573',
  });
  console.log('PROBE-ARTIFACT CLEANUP DONE');
  await browser.close();
})().catch(e => { console.error('CLEANUP ERROR:', e.message); process.exit(1); });
