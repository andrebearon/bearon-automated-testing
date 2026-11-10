// Probe fix-2b: (1) click the Dine In order-type button, dump the
// dropdown options; (2) fill the notes input, click Card, then read the
// notes input value again — does selecting a payment method wipe it?
// No sale is completed.
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
  await sleep(1000);
  await page.getByRole('button', { name: /checkout/i }).first().click();
  await sleep(3000);
  // (1) Order-type dropdown
  const dineInBtn = page.locator('button', { hasText: 'Dine In' }).first();
  console.log('DINE IN BUTTON count:', await dineInBtn.count());
  await dineInBtn.click();
  await sleep(1500);
  const opts = await page.getByRole('option').allInnerTexts().catch(() => []);
  console.log('ROLE=OPTION texts:', JSON.stringify(opts));
  const listbox = await page.locator('[role="listbox"], [role="menu"]').allInnerTexts().catch(() => []);
  console.log('LISTBOX/MENU texts:', JSON.stringify(listbox));
  const bodyAfter = await page.locator('body').innerText();
  console.log('TAKE AWAY visible after open:', /take away/i.test(bodyAfter));
  // Click Take Away if present as text
  const ta = page.getByText('Take Away', { exact: true });
  console.log('TAKE AWAY text count:', await ta.count());
  if (await ta.count()) {
    await ta.first().click();
    await sleep(1200);
    console.log('AFTER TA CLICK, body has Take Away:', /take away/i.test(await page.locator('body').innerText()));
    console.log('AFTER TA CLICK, Dine In still visible:', /dine in/i.test(await page.locator('body').innerText()));
  } else {
    await page.keyboard.press('Escape');
    await sleep(800);
  }
  // (2) Notes survival across payment-method click
  const noteInput = page.getByPlaceholder(/add any notes/i).first();
  console.log('NOTE INPUT count:', await noteInput.count());
  await noteInput.fill('Probe note 12345');
  console.log('NOTE VALUE after fill:', await noteInput.inputValue());
  await page.getByText('Card', { exact: true }).first().click();
  await sleep(1500);
  const noteInput2 = page.getByPlaceholder(/add any notes/i).first();
  console.log('NOTE INPUT count after Card click:', await noteInput2.count());
  if (await noteInput2.count()) console.log('NOTE VALUE after Card click:', await noteInput2.inputValue());
  // Also check: does the checkout still show Take Away as order type?
  const body2 = await page.locator('body').innerText();
  console.log('ORDER TYPE shown now:', /take away/i.test(body2) ? 'Take Away' : (/dine in/i.test(body2) ? 'Dine In' : 'unknown'));
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
