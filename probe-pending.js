const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  const wasOn = await h.setPosFeature(page, 'Let staff hold open orders', true);
  console.log('HOLD FEATURE WAS:', wasOn);
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  await page.getByText('Auto Test 82204090', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const btns = await page.getByRole('button').allInnerTexts();
  console.log('CART BUTTONS:', JSON.stringify(btns.filter(t => /pending|hold|save/i.test(t))));
  // Save to pending if the button exists.
  const saveBtn = page.getByRole('button', { name: /save.*pending|hold order/i }).first();
  if (await saveBtn.count()) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log('AFTER SAVE-TO-PENDING, URL:', page.url());
    console.log('BODY TAIL:', (await page.locator('body').innerText()).slice(-800));
  } else {
    console.log('NO SAVE-TO-PENDING BUTTON');
    const clear = page.getByRole('button', { name: /clear cart/i });
    if (await clear.count()) await clear.click();
  }
  await h.setPosFeature(page, 'Let staff hold open orders', wasOn);
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
