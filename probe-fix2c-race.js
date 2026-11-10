// Probe fix-2c: reproduce the helper's exact no-wait sequence — click
// Checkout, then IMMEDIATELY count the Dine In text and the notes input
// (no sleep). If both are 0 right after the click, the baseline failure
// was a race: the checkout view had not rendered yet, and the helper's
// silent count() guards skipped both the type switch and the note.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await sleep(3000);
  await page.getByText('Sales Prod 70204048').first().click();
  await sleep(800);
  await page.getByRole('button', { name: /checkout/i }).first().click();
  // Immediately, exactly like the helper does:
  const t0 = Date.now();
  const typeCount = await page.getByText('Dine In', { exact: true }).count();
  const noteCount = await page.getByPlaceholder(/add any notes/i).count();
  const summaryVisible = await page.getByText('Order Summary').count();
  console.log(`IMMEDIATELY after Checkout click (+${Date.now() - t0}ms): Dine In count=${typeCount}, notes input count=${noteCount}, Order Summary count=${summaryVisible}`);
  await sleep(1000);
  console.log(`+1s: Dine In=${await page.getByText('Dine In', { exact: true }).count()}, notes=${await page.getByPlaceholder(/add any notes/i).count()}, summary=${await page.getByText('Order Summary').count()}`);
  await sleep(2000);
  console.log(`+3s: Dine In=${await page.getByText('Dine In', { exact: true }).count()}, notes=${await page.getByPlaceholder(/add any notes/i).count()}, summary=${await page.getByText('Order Summary').count()}`);
  await sleep(3000);
  console.log(`+6s: Dine In=${await page.getByText('Dine In', { exact: true }).count()}, notes=${await page.getByPlaceholder(/add any notes/i).count()}, summary=${await page.getByText('Order Summary').count()}`);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
