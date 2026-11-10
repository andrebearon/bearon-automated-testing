// Cleanup probe: delete the two products left by this task's own failed
// intermediate runs (CRUD Prod 70592238, Sales Prod 70770345) and try
// their categories. Own run records only; best-effort, never throws.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

async function deleteProduct(page, name) {
  try {
    await page.goto('/console/pos/dashboard/inventory/products/');
    const search = page.getByPlaceholder(/search products/i).first();
    await search.fill(name);
    await sleep(1500);
    const row = page.locator('tr', { hasText: name }).first();
    if (!(await row.count())) { console.log(`CLEANUP: ${name} not found, skipping`); return; }
    await row.locator('button').filter({ hasNotText: /.+/ }).first().click();
    await sleep(1200);
    const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
    if (await menuDelete.count()) await menuDelete.click();
    else await page.getByText('Delete', { exact: true }).last().click();
    await sleep(1500);
    const confirmDelete = page.getByRole('button', { name: /^delete$/i }).first();
    if (await confirmDelete.count()) await confirmDelete.click();
    await sleep(1500);
    const gone = (await page.getByText(name, { exact: true }).count()) === 0;
    console.log(`CLEANUP: delete ${name}: ${gone ? 'GONE' : 'STILL PRESENT'}`);
  } catch (e) { console.log(`CLEANUP: delete ${name} FAILED: ${e.message}`); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await deleteProduct(page, 'CRUD Prod 70592238');
  await deleteProduct(page, 'Sales Prod 70770345');
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
