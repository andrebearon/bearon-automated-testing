// Read-only probe: category details controls for scenario 2.
// Uses the leftover category from scenario 1 run (CRUD Cat 79456153).
// No creation, no deletion, no edits — just reads the details page.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console');
  await page.getByRole('heading', { name: 'Home' }).first().waitFor({ timeout: 30000 });
  const body = await page.locator('body').innerText();
  console.log('WORKSPACE Cafe muse2:', /Cafe muse2/.test(body));
  await page.goto('https://bearon.studio/console/pos/dashboard/inventory/categories/');
  const search = page.getByPlaceholder(/search categories/i).first();
  await search.fill('CRUD Cat 79456153');
  await page.waitForTimeout(1500);
  const row = page.locator('tr', { hasText: 'CRUD Cat 79456153' }).first();
  console.log('ROW VISIBLE:', await row.count());
  console.log('ROW BUTTONS:', await row.locator('button').allInnerTexts().catch(() => []));
  const viewBtn = row.getByRole('button', { name: 'View' }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await page.waitForTimeout(2000);
    console.log('DETAILS URL:', page.url());
    console.log('DETAILS BUTTONS:', await page.locator('button').allInnerTexts().then(t => t.filter(x => x.trim()).slice(0, 40)));
    console.log('DETAILS INPUTS:', await page.locator('input').evaluateAll(els => els.map(e => ({ name: e.name, value: e.value, placeholder: e.placeholder })).slice(0, 20)));
    console.log('PAGE HAS Delete:', (await page.getByText(/delete/i).count()));
  }
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
