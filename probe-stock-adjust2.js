// Interactive probe: create a tracked product, open the adjustment form,
// pick the product, and dump what fields appear after selection.
// Then delete the probe product (best-effort).
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const suffix = Date.now().toString().slice(-8);
const PRODUCT = `Probe Stock ${suffix}`;
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, { name: PRODUCT, category: 'Auto Category', price: 10000, description: `probe ${suffix}`, trackInventory: true });
  await page.goto('/console/pos/dashboard/inventory/manage-stocks/');
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  await page.waitForTimeout(1500);
  const search = page.getByPlaceholder(/search products by name or sku/i).first();
  await search.fill(PRODUCT);
  await page.waitForTimeout(2000);
  console.log('OPTIONS AFTER SEARCH:', await page.getByRole('option').allInnerTexts().catch(() => []));
  console.log('PRODUCT ROWS:', await page.locator('[role="dialog"]').innerText().then(t => t.slice(0, 800)));
  const opt = page.getByRole('option', { name: PRODUCT }).first();
  if (await opt.count()) await opt.click();
  else await page.getByText(PRODUCT).first().click();
  await page.waitForTimeout(2500);
  console.log('--- AFTER PICK ---');
  console.log('DIALOG TEXT:', (await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog')).slice(0, 1500));
  console.log('NUMBER INPUTS:', await page.locator('[role="dialog"] input[type="number"]').evaluateAll(els => els.map(e => ({ name: e.name, placeholder: e.placeholder, value: e.value }))));
  console.log('ALL DIALOG INPUTS:', await page.locator('[role="dialog"] input').evaluateAll(els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder }))));
  await page.keyboard.press('Escape');
  await h.bestEffort(`delete probe product ${PRODUCT}`, async () => { await h.deleteProductByKebab(page, PRODUCT); });
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
