// Diagnostic probe #2 for scenario 6: dump the Reason control markup in
// the Stock Adjustment dialog, and verify the product picker opens via
// the button[role="combobox"] locator. Makes NO changes (no submit).
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
  const dlgHtml = await page.locator('[role="dialog"]').first().evaluate((d) => d.outerHTML.slice(0, 4000));
  console.log('DIALOG HTML (first 4000 chars):\n', dlgHtml);
  const reasonInfo = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const selects = [...dlg.querySelectorAll('select')].map(s => ({
      name: s.name, optionCount: s.options.length,
      options: [...s.options].map(o => o.text).slice(0, 12),
    }));
    const combos = [...dlg.querySelectorAll('button[role="combobox"]')].map(b => (b.innerText || '').trim());
    return { selects, combos };
  });
  console.log('SELECTS:', JSON.stringify(reasonInfo.selects));
  console.log('COMBOBOXES IN DIALOG:', JSON.stringify(reasonInfo.combos));
  // Verify picker opens with the CSS locator.
  const picker = page.locator('[role="dialog"]').first().locator('button[role="combobox"]', { hasText: 'Select a product' });
  console.log('PICKER COUNT:', await picker.count());
  await picker.first().click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  const search = page.getByPlaceholder(/search products by name or sku/i);
  console.log('SEARCH VISIBLE AFTER PICKER CLICK:', await search.first().isVisible().catch(() => false));
  await page.keyboard.press('Escape');
  await browser.close();
  console.log('PROBE DONE (no changes made)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
