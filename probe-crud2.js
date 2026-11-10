// Probe 2: Options + Add-ons tabs in the product form; Order Details actions;
// till order-type + payment options. Read-only except: none (no saves).
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 2000) {
  console.log(`\n===== ${label} =====`);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText().catch(() => '');
  console.log('BODY:', body.slice(0, maxChars).replace(/\n+/g, ' | '));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 60)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''}`).slice(0, 50)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // Product form tabs
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(3000);
  await page.getByRole('tab', { name: /options/i }).click().catch(e => console.log('options tab click fail', e.message));
  await sleep(2000);
  await dump(page, 'PRODUCT FORM — OPTIONS TAB', 2500);
  await page.getByRole('tab', { name: /add-ons/i }).click().catch(e => console.log('addons tab click fail', e.message));
  await sleep(2000);
  await dump(page, 'PRODUCT FORM — ADD-ONS TAB', 2500);
  // Cancel out
  const cancel = page.getByRole('button', { name: /cancel/i }).first();
  if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1500); }

  // Order Details for an existing demo-workspace order (view only)
  await page.goto('/console/pos/dashboard/pos/order-management/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const viewBtn = page.getByRole('button', { name: /view details/i }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await sleep(3000);
    await dump(page, 'ORDER DETAILS (CEE-51004, view only)', 2500);
    // Date range control presence on OM page
    await page.goto('/console/pos/dashboard/pos/order-management/', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    const dr = page.getByText(/Oct 05, 2026 - Nov 05, 2026|Nov 05, 2026/).first();
    console.log('DATE RANGE TEXT PRESENT:', await dr.count());
  }

  // Till: add a product to cart, open checkout, dump order type + payment options
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const tile = page.getByText('Auto Test 52847007').first();
  if (await tile.count()) {
    await tile.click();
    await sleep(1500);
    await page.getByRole('button', { name: /checkout/i }).first().click().catch(e => console.log('checkout click fail', e.message));
    await sleep(3000);
    await dump(page, 'CHECKOUT (order type + payment)', 2500);
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
