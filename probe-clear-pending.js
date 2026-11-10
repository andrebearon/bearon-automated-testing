// Probe: clear leftover pending orders (16:10 sprint) via the OM
// "Pending Orders" tab. Dumps the tab's table + controls, then tries
// Cancel/Delete on each row and verifies it is gone.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/order-management/');
  await page.waitForTimeout(3000);
  const tab = page.getByRole('tab', { name: /pending orders/i }).first();
  if (await tab.count()) { await tab.click(); } else {
    const btn = page.getByRole('button', { name: /pending orders/i }).first();
    if (await btn.count()) await btn.click();
    else console.log('NO PENDING ORDERS TAB FOUND');
  }
  await sleep(2500);
  const body = await page.locator('body').innerText();
  console.log('PENDING TAB BODY:', body.replace(/\n+/g, ' | ').slice(-1200));
  const rows = page.locator('table tbody tr');
  console.log('ROW COUNT:', await rows.count());
  const btns = await page.locator('button').allInnerTexts();
  console.log('BUTTONS:', JSON.stringify(btns.filter(b => b && b.length < 60)));
  // Try to clear each row: click row -> look for Cancel/Delete in details.
  for (let i = 0; i < 4; i++) {
    const r = page.locator('table tbody tr').first();
    if (!(await r.count())) { console.log('NO MORE ROWS'); break; }
    const rowText = (await r.innerText()).replace(/\n+/g, ' | ');
    console.log(`ROW ${i}: ${rowText}`);
    // Kebab menu on the row, if any.
    const kebab = r.locator('button').last();
    try {
      await kebab.click({ timeout: 5000 });
      await sleep(1500);
      const menu = await page.locator('body').innerText();
      console.log('AFTER KEBAB:', menu.replace(/\n+/g, ' | ').slice(-600));
      const cancel = page.getByRole('menuitem', { name: /cancel|delete|void/i }).first();
      if (await cancel.count()) {
        console.log('MENU ITEM FOUND:', await cancel.innerText());
        await cancel.click();
        await sleep(2000);
        const confirm = page.getByRole('button', { name: /confirm|cancel order|delete|yes/i }).first();
        if (await confirm.count()) { console.log('CONFIRM BTN:', await confirm.innerText()); await confirm.click(); await sleep(2500); }
        console.log(`ROW ${i} CLEAR ATTEMPT DONE`);
      } else {
        console.log('NO CANCEL/DELETE MENU ITEM — closing menu');
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      console.log(`ROW ${i} KEBAB FAILED:`, e.message.slice(0, 200));
    }
    await sleep(1000);
  }
  const after = await page.locator('body').innerText();
  console.log('AFTER CLEAR BODY:', after.replace(/\n+/g, ' | ').slice(-800));
  console.log('FINAL ROW COUNT:', await page.locator('table tbody tr').count());
  await browser.close();
  console.log('CLEAR PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
