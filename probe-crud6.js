// Probe 6 (read-only): click the unlabeled button next to a product row's
// View button — likely a row actions menu — and dump what opens. Cancel out.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  // Each row: a View button + one unlabeled button. Target the unlabeled
  // button in the first data row.
  const row = page.locator('tr', { has: page.getByRole('button', { name: 'View' }) }).first();
  const unlabeled = row.locator('button').filter({ hasNotText: /.+/ }).first();
  console.log('UNLABELED ROW BUTTON COUNT:', await unlabeled.count());
  if (await unlabeled.count()) {
    await unlabeled.click();
    await sleep(1500);
    const menu = await page.locator('[role="menu"], [role="listbox"]').allInnerTexts().catch(() => []);
    console.log('MENU TEXTS:', menu);
    const body = await page.locator('body').innerText();
    console.log('BODY TAIL:', body.slice(-800).replace(/\n+/g, ' | '));
    console.log('HAS DELETE NOW:', /delete/i.test(body));
    await page.keyboard.press('Escape');
    await sleep(800);
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
