// Read-only probe of the product list page + (if present) the add-product form.
// Does NOT save anything: it opens the form and closes it without submitting.
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  console.log('URL:', page.url());
  console.log('BODY HEAD:', (await page.locator('body').innerText()).slice(0, 800));
  const buttons = await page.locator('button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 40));
  console.log('BUTTONS:', buttons.join(' | '));
  const add = page.getByRole('button', { name: /add.*product|new.*product/i }).first();
  if (await add.count()) {
    await add.click();
    await page.waitForTimeout(3000);
    console.log('FORM BODY:', (await page.locator('body').innerText()).slice(0, 1200));
    const fields = await page.locator('input, textarea, select').evaluateAll(els =>
      els.map(e => `${e.tagName} name=${e.getAttribute('name')||''} placeholder=${e.getAttribute('placeholder')||''} aria=${e.getAttribute('aria-label')||''}`).slice(0, 40));
    console.log('FIELDS:\n' + fields.join('\n'));
    const formButtons = await page.locator('button').evaluateAll(els =>
      els.map(b => (b.innerText || '').trim()).filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 40));
    console.log('FORM BUTTONS:', formButtons.join(' | '));
  } else {
    console.log('No add-product button found.');
  }
  await browser.close();
})();
