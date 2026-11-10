// Probe 2 (rewritten): delete the 2 leftover pending orders (PCEE-51001
// Slot 1, PCEE-51002 Slot 2) via Details -> "Delete Order".
// LESSON from failed rounds: the Pending Orders switch is a BUTTON
// (role=tab finds 0; getByText exact fails on the "Pending Orders\n2"
// label), and the table must be WAITED on (PCEE- refs) — a bare sleep
// leaves the All Orders list showing.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gotoPendingTab(page) {
  await page.goto('/console/pos/dashboard/pos/order-management/');
  await sleep(3000);
  const btn = page.getByRole('button', { name: /pending orders/i }).first();
  await btn.click({ timeout: 15000 });
  await page.waitForFunction(() => /PCEE-\d+/.test(document.body.innerText), { timeout: 20000 });
  await sleep(1000);
}

(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoPendingTab(page);
    const rows = page.locator('table tbody tr');
    const n = await rows.count();
    console.log(`ATTEMPT ${attempt}: pending rows = ${n}`);
    if (n === 0) break;
    const rowText = (await rows.first().innerText()).replace(/\n+/g, ' | ');
    console.log(`DELETING ROW: ${rowText}`);
    if (!/PCEE-/.test(rowText)) { console.log('ABORT: first row is not a pending order'); break; }
    await rows.first().getByRole('button', { name: 'View Details' }).click();
    await sleep(2500);
    const det = await page.locator('body').innerText();
    const refM = det.match(/Reference: #(PCEE-\d+)/);
    console.log('DETAILS REF:', refM ? refM[1] : 'n/a');
    const delBtn = page.getByRole('button', { name: 'Delete Order' });
    await delBtn.first().click({ timeout: 10000 });
    await sleep(2000);
    const dlg = await page.locator('body').innerText();
    console.log('AFTER DELETE CLICK:', dlg.replace(/\n+/g, ' | ').slice(-500));
    const confirm = page.getByRole('button', { name: /delete|confirm|yes/i }).first();
    if (await confirm.count()) {
      console.log('CONFIRM BTN:', await confirm.innerText());
      await confirm.click();
      await sleep(3000);
    }
    console.log(`ROW ${attempt} DELETE ATTEMPT DONE`);
  }
  await gotoPendingTab(page).catch(async () => {
    await page.goto('/console/pos/dashboard/pos/order-management/');
    await sleep(3000);
    console.log('FINAL CHECK: pending tab did not reload PCEE rows (likely 0 left)');
  });
  console.log('FINAL PENDING ROW COUNT:', await page.locator('table tbody tr').count());
  await browser.close();
  console.log('CLEAR PROBE 2 DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
