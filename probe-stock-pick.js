// Diagnostic probe #3 for scenario 6: find the REAL search input in the
// product-picker popover and the REAL option elements. Makes NO changes.
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
  const inputs = await page.evaluate(() => {
    return [...document.querySelectorAll('input[placeholder]')].map((el) => ({
      ph: el.placeholder, visible: el.offsetParent !== null,
      rect: JSON.stringify(el.getBoundingClientRect()),
      inDialog: !!el.closest('[role="dialog"]'),
      ancestorCmdk: !!el.closest('[cmdk-root], [data-cmdk-root], [role="listbox"]'),
    }));
  });
  console.log('PLACEHOLDER INPUTS:', JSON.stringify(inputs, null, 1));
  // Fill the input that is inside the picker popover (not the page search):
  // prefer one whose ancestor is NOT the page header/list, i.e. the one
  // that appeared after the picker click — the last visible one.
  const cands = page.getByPlaceholder(/search products by name or sku/i);
  console.log('SEARCH CANDIDATE COUNT:', await cands.count());
  for (let i = 0; i < await cands.count(); i++) {
    const c = cands.nth(i);
    console.log(`  cand ${i}: visible=${await c.isVisible().catch(() => false)}`);
  }
  // Fill the LAST visible candidate (popover inputs render after page inputs).
  const visibleIdx = [];
  for (let i = 0; i < await cands.count(); i++) {
    if (await cands.nth(i).isVisible().catch(() => false)) visibleIdx.push(i);
  }
  const target = cands.nth(visibleIdx[visibleIdx.length - 1]);
  await target.fill('Stock Prod');
  await page.waitForTimeout(2500);
  const opts = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[role="option"], [cmdk-item], [data-value]')];
    return els.filter(e => (e.innerText || '').includes('Stock Prod')).map(e => ({
      tag: e.tagName, role: e.getAttribute('role'), text: (e.innerText || '').trim().slice(0, 80),
      visible: e.offsetParent !== null,
    }));
  });
  console.log('OPTION ELEMENTS WITH Stock Prod:', JSON.stringify(opts, null, 1));
  // Also: any visible button containing Stock Prod?
  const btns = await page.locator('button:visible', { hasText: 'Stock Prod' }).count();
  console.log('VISIBLE BUTTONS WITH Stock Prod:', btns);
  const dlgText = await page.locator('[role="dialog"]').first().innerText();
  console.log('DIALOG TEXT NOW:', dlgText.replace(/\n+/g, ' | ').slice(0, 400));
  await page.keyboard.press('Escape');
  await browser.close();
  console.log('PROBE DONE (no changes made)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
