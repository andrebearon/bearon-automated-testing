// Discovery probe for scenarios 11/12/10-cancel: create 2 layout slots,
// save a pending order on Slot 1, find where it shows, inspect its
// details/actions, then cancel it (cleanup). Product is deleted at the
// end. Slots stay saved (shared fixture for the specs).
const { chromium, expect } = require('@playwright/test');
const h = require('./tests/helpers');
const suffix = Date.now().toString().slice(-8);
const PRODUCT = `Pend Probe ${suffix}`;
const PRICE = 15000;
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('DEFAULT STATUS:', await h.registerStatus(page, 'Default'));

  // ---- 1. Slots already saved by the previous probe run --------------------
  await page.goto('/console/pos/dashboard/pos/pos-settings/business-layout/');
  await page.waitForTimeout(4000);
  const layoutText = await page.locator('body').innerText();
  console.log('EXISTING SLOTS:', (layoutText.match(/Slot \d+/g) || []).join(', '));
  console.log('VERSION:', (layoutText.match(/v\d+\.\d+\.\d+/) || ['?'])[0]);

  // ---- 2. Own product --------------------------------------------------------
  await h.ensureCategory(page, 'Auto Category');
  await h.createSimpleProduct(page, { name: PRODUCT, category: 'Auto Category', price: PRICE, description: `Pending probe ${suffix}` });

  // ---- 3. Hold-orders feature ON, till, add product, Save Pending -----------
  const holdWas = await h.setPosFeature(page, 'Let staff hold open orders', true);
  console.log('HOLD-ORDERS WAS:', holdWas);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  await page.getByText(PRODUCT, { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const savePend = page.getByRole('button', { name: 'Save Pending Order' });
  console.log('SAVE PENDING BUTTON COUNT:', await savePend.count());
  await savePend.click();
  await page.waitForTimeout(2500);
  const panelText = await page.locator('body').innerText();
  console.log('PENDING PANEL (first 1500):', panelText.replace(/\n+/g, ' | ').slice(0, 1500));
  // Tap Slot 1.
  const slot1 = page.getByRole('button', { name: /Slot 1/ }).first();
  console.log('SLOT 1 BUTTON COUNT:', await slot1.count());
  if (await slot1.count()) {
    await slot1.click();
    await page.waitForTimeout(3000);
    const after = await page.locator('body').innerText();
    console.log('AFTER SLOT 1 TAP (first 1000):', after.replace(/\n+/g, ' | ').slice(0, 1000));
  }

  // ---- 4. Where does the pending order show? OM search -----------------------
  await page.goto('/console/pos/dashboard/pos/order-management/');
  await page.waitForTimeout(3000);
  const omText = await page.locator('body').innerText();
  console.log('OM TEXT (first 1200):', omText.replace(/\n+/g, ' | ').slice(0, 1200));
  await browser.close();
  console.log('PROBE DONE (pending order + product NOT yet cleaned — see log)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
