const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await h.openOrderDetails(page, 'CEE-51017');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Update Status' }).click();
  await page.waitForTimeout(1500);
  // The dialog's Status control: find the dialog container, then the
  // element showing 'Paid' inside it (not the page-level status).
  const dialog = page.locator('div', { hasText: 'Update Order Status' }).last();
  const field = dialog.locator('text=Paid').last();
  console.log('FIELD COUNT:', await field.count());
  await field.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  console.log('LISTBOX OPTIONS:', JSON.stringify(await page.getByRole('option').allInnerTexts().catch(() => [])));
  console.log('LISTBOX?:', await page.locator('[role="listbox"]').count(), 'COMBOBOX?:', await page.locator('[role="combobox"]').count());
  console.log('BODY TAIL:', (await page.locator('body').innerText()).slice(-900));
  // Close without saving: Escape then the dialog Cancel.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
