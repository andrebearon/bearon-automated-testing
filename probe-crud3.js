// Probe 3: option-group / add-on-group sub-forms; Order Details dialogs
// (Update Status / Void / Refund — opened then CANCELLED, nothing confirmed);
// product View page; till order-type options + Card payment dialog.
// Nothing is saved or confirmed in this probe.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function dump(page, label, maxChars = 2200) {
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

async function closeDialog(page) {
  const cancel = page.getByRole('button', { name: /cancel|close|back/i }).first();
  if (await cancel.count()) { await cancel.click().catch(() => {}); await sleep(1200); }
  // Also try Escape
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
}

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // --- Product form: option group sub-form ---
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.getByRole('button', { name: /add product/i }).first().click();
  await sleep(3000);
  await page.getByRole('tab', { name: /options/i }).click();
  await sleep(1500);
  await page.getByRole('button', { name: /add option group/i }).first().click();
  await sleep(1500);
  await dump(page, 'OPTION GROUP SUB-FORM', 2000);
  // Fill group name + one value (no save; form will be discarded)
  const optInputs = page.locator('input');
  const n = await optInputs.count();
  console.log('option-form input count:', n);
  await page.getByRole('tab', { name: /add-ons/i }).click();
  await sleep(1500);
  await page.getByRole('button', { name: /add add-on group/i }).first().click();
  await sleep(1500);
  await dump(page, 'ADD-ON GROUP SUB-FORM', 2000);
  await closeDialog(page);
  // Leave the add form without saving: navigate away
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  // --- Product View page (existing product, view only) ---
  const search = page.getByPlaceholder(/search products/i).first();
  await search.fill('Auto Test 52847007');
  await sleep(2000);
  const viewBtn = page.getByRole('button', { name: /^view$/i }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await sleep(3000);
    await dump(page, 'PRODUCT VIEW PAGE', 2500);
  }

  // --- Order Details dialogs (open, dump, cancel) ---
  await page.goto('/console/pos/dashboard/pos/order-management/details/?orderId=366&pendingOrderId=', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const upd = page.getByRole('button', { name: /update status/i }).first();
  if (await upd.count()) { await upd.click(); await sleep(1500); await dump(page, 'UPDATE STATUS DIALOG', 1500); await closeDialog(page); }
  const voidBtn = page.getByRole('button', { name: /void order/i }).first();
  if (await voidBtn.count()) { await voidBtn.click(); await sleep(1500); await dump(page, 'VOID DIALOG', 1500); await closeDialog(page); }
  const refundBtn = page.getByRole('button', { name: /refund order/i }).first();
  if (await refundBtn.count()) { await refundBtn.click(); await sleep(1500); await dump(page, 'REFUND DIALOG', 1500); await closeDialog(page); }

  // --- Till: order type options + Card payment dialog ---
  await page.goto('/console/pos/dashboard/pos/sales/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  await page.getByText('Auto Test 52847007').first().click();
  await sleep(1200);
  const orderType = page.getByText('Dine In', { exact: true }).first();
  if (await orderType.count()) { await orderType.click().catch(() => {}); await sleep(1500); await dump(page, 'ORDER TYPE DROPDOWN', 1200); await page.keyboard.press('Escape'); await sleep(800); }
  await page.getByRole('button', { name: /checkout/i }).first().click();
  await sleep(2500);
  const card = page.getByText('Card', { exact: true }).first();
  if (await card.count()) { await card.click(); await sleep(2500); await dump(page, 'CARD PAYMENT VIEW', 2000); }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
