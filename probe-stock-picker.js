// Diagnostic probe for scenario 6: dump the Stock Adjustment dialog DOM
// so the product picker can be located correctly. Makes NO changes:
// opens the dialog, inspects, closes it with Escape.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('VERSION:', ((await page.locator('body').innerText()).match(/v\d+\.\d+\.\d+/) || ['?'])[0]);
  await page.goto('/console/pos/dashboard/inventory/manage-stocks/');
  await page.waitForTimeout(3000);
  try {
    const later = page.getByRole('button', { name: 'Later', exact: true }).first();
    await later.waitFor({ state: 'visible', timeout: 5000 });
    await later.click();
    await h.sleep(1000);
    console.log('TOAST DISMISSED');
  } catch { console.log('NO TOAST'); }
  await page.getByRole('button', { name: /create stock adjustment/i }).first().click();
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const out = {};
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    out.dialogCount = dialogs.length;
    out.dialogs = dialogs.map((d, i) => ({
      i, visible: d.offsetParent !== null, cls: (d.className || '').slice(0, 80),
      text: (d.innerText || '').replace(/\n+/g, ' | ').slice(0, 200),
    }));
    const all = [...document.querySelectorAll('button, [role="combobox"], [role="button"]')];
    out.pickerMatches = all.filter(e => (e.innerText || e.textContent || '').trim().includes('Select a product')).map(e => ({
      tag: e.tagName, role: e.getAttribute('role'), text: (e.innerText || '').trim().slice(0, 60),
      visible: e.offsetParent !== null, disabled: e.disabled,
      rect: JSON.stringify(e.getBoundingClientRect()),
      parentRole: e.parentElement?.getAttribute('role') || e.parentElement?.tagName,
    }));
    return out;
  });
  console.log('DIALOGS:', JSON.stringify(info.dialogs, null, 1));
  console.log('PICKER MATCHES:', JSON.stringify(info.pickerMatches, null, 1));
  // Try the combobox-role locator, then the visible button locator.
  const combo = page.getByRole('combobox', { name: 'Select a product' });
  console.log('COMBOBOX COUNT:', await combo.count());
  if (await combo.count()) {
    await combo.first().click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/search products by name or sku/i);
    console.log('SEARCH INPUT COUNT AFTER COMBOBOX CLICK:', await search.count(), 'VISIBLE:', await search.first().isVisible().catch(() => false));
    if (await search.count()) {
      await search.first().fill('Stock Prod');
      await page.waitForTimeout(2000);
      const opts = await page.locator('button:visible', { hasText: 'Stock Prod' }).count();
      console.log('VISIBLE PRODUCT OPTIONS AFTER SEARCH:', opts);
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  console.log('DIALOG STILL OPEN AFTER ESC:', await page.locator('[role="dialog"]').first().isVisible().catch(() => false));
  await browser.close();
  console.log('PROBE DONE (no changes made)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
