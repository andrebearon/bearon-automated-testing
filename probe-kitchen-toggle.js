// Probe: the "Turn on Show orders on a kitchen screen" control on the board.
// Clicks it once and reports what happens (does it toggle on? open settings?).
// The spec will turn tickets back OFF at the end, restoring the workspace.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/pos/kitchen-display/display/?locationId=54&screenId=6');
  await page.waitForTimeout(3000);
  const toggle = page.getByText(/turn on/i).first();
  console.log('TOGGLE TEXT COUNT:', await toggle.count());
  console.log('TOGGLE TAG:', await toggle.evaluate(el => el.tagName + ' role=' + el.getAttribute('role')).catch(() => '?'));
  // Find the clickable ancestor / button containing that text.
  const btn = page.locator('button', { hasText: /show orders on a kitchen screen/i }).first();
  console.log('BUTTON COUNT:', await btn.count());
  const target = (await btn.count()) ? btn : toggle;
  await target.click();
  await page.waitForTimeout(3000);
  console.log('URL AFTER CLICK:', page.url());
  console.log('PAGE TEXT AFTER:', (await page.locator('body').innerText()).slice(0, 1200).replace(/\n+/g, ' | '));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
