// Diagnostic probe #4 for scenario 6: pick a known leftover product via
// the role=option element, then dump the quantity field markup that
// appears. Makes NO changes (no submit; Escape to close).
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/inventory/manage-stocks/');
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('[role="dialog"]').first().locator('button[role="combobox"]', { hasText: 'Select a product' }).click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/search products by name or sku/i).first().fill('Probe Stock 80717409');
  await page.waitForTimeout(2500);
  const opt = page.getByRole('option', { name: /Probe Stock 80717409/ });
  console.log('OPTION COUNT for Probe Stock 80717409:', await opt.count());
  await opt.first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const dlgText = await page.locator('[role="dialog"]').first().innerText();
  console.log('DIALOG TEXT AFTER PICK:', dlgText.replace(/\n+/g, ' | ').slice(0, 600));
  const fields = await page.locator('[role="dialog"]').first().evaluate((d) => {
    return [...d.querySelectorAll('input, select, button[role="combobox"]')].map(e => ({
      tag: e.tagName, type: e.type || '', role: e.getAttribute('role') || '',
      name: e.name || '', ph: e.placeholder || '', text: (e.innerText || '').trim().slice(0, 40),
      visible: e.offsetParent !== null,
    }));
  });
  console.log('DIALOG FIELDS:', JSON.stringify(fields, null, 1));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await browser.close();
  console.log('PROBE DONE (no changes made)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
