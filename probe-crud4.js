// Probe 4 (read-only, nothing saved/confirmed):
// - option "Add value" row fields; add-on "Add choice" row fields
// - product details page: Edit/Delete controls
// - till order-type selector options
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dumpInputs(page, label) {
  console.log(`\n===== ${label} =====`);
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(e => `${e.tagName} name=${e.getAttribute('name') || ''} ph=${e.getAttribute('placeholder') || ''} type=${e.getAttribute('type') || ''} value=${(e.value || '').slice(0, 30)}`).slice(0, 60)).catch(() => []);
  console.log('INPUTS:\n' + inputs.join('\n'));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 80)).catch(() => []);
  console.log('BUTTONS:', buttons.join(' | '));
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(3000);
  // Options: add group, name it, add a value
  await page.getByRole('tab', { name: /options/i }).click();
  await sleep(1200);
  await page.getByRole('button', { name: /add option group/i }).first().click();
  await sleep(1200);
  await page.getByPlaceholder(/eg: Size/i).fill('Size');
  await page.getByRole('button', { name: /add value/i }).first().click();
  await sleep(1200);
  await dumpInputs(page, 'OPTION GROUP AFTER ADD VALUE');
  // Add-ons: add group, name it, add a choice
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await sleep(1200);
  await page.getByRole('button', { name: /add add-on group/i }).first().click();
  await sleep(1200);
  await page.getByPlaceholder(/eg: Extras/i).fill('Extras');
  await page.getByRole('button', { name: /add choice/i }).first().click();
  await sleep(1200);
  await dumpInputs(page, 'ADD-ON GROUP AFTER ADD CHOICE');

  // Product details page controls (existing product, view only)
  await page.goto('/console/pos/dashboard/inventory/products/details/?productId=357&tab=', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  await dumpInputs(page, 'PRODUCT DETAILS productId=357');
  const del = page.getByRole('button', { name: /delete/i });
  console.log('DELETE BUTTON COUNT:', await del.count());
  const edit = page.getByRole('button', { name: /edit product/i });
  console.log('EDIT BUTTON COUNT:', await edit.count());
  // Any kebab/more menu?
  const more = page.locator('button[aria-label*="more" i], button[aria-label*="menu" i]');
  console.log('MORE-MENU BUTTON COUNT:', await more.count());

  // Till order-type selector
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const combo = page.locator('[role="combobox"]').first();
  console.log('TILL COMBOBOX COUNT:', await combo.count());
  const dineIn = page.locator('text=Dine In').first();
  console.log('DINE IN TEXT COUNT:', await dineIn.count());
  // Try clicking the order-type area: it is near "Order Type" label
  const ot = page.getByText('Order Type').first();
  console.log('ORDER TYPE LABEL COUNT:', await ot.count());
  if (await dineIn.count()) {
    await dineIn.click().catch(e => console.log('dinein click err', e.message));
    await sleep(1500);
    const opts = await page.locator('[role="option"]').allInnerTexts().catch(() => []);
    console.log('ORDER TYPE OPTIONS:', opts);
    const body = await page.locator('body').innerText();
    console.log('TILL BODY AFTER DINEIN CLICK:', body.slice(0, 900).replace(/\n+/g, ' | '));
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
