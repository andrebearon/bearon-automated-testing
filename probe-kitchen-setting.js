// Read-only probe: the "Show orders on a kitchen screen" row in POS settings.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/settings/features/pos/');
  await page.waitForTimeout(3000);
  const row = page.locator('text=Show orders on a kitchen screen').first();
  console.log('ROW COUNT:', await row.count());
  const container = page.locator('div', { hasText: 'Show orders on a kitchen screen' }).last();
  console.log('SWITCHES ON PAGE:', await page.locator('[role="switch"]').count());
  const switches = await page.locator('[role="switch"]').evaluateAll(els => els.map(e => ({ checked: e.getAttribute('aria-checked'), label: (e.closest('div')?.innerText || '').slice(0, 80) })));
  console.log('SWITCH STATES:', JSON.stringify(switches, null, 1).slice(0, 2000));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
