// Diagnostic only: click kebab Delete on PO #051621002, click the
// received-PO dialog's Delete explicitly, then report dialog/toast/row.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await page.goto('https://bearon.studio/console/pos/dashboard/inventory/purchase-orders/');
  await page.getByPlaceholder(/search/i).first().fill('051621002');
  await page.waitForTimeout(2000);
  const row = page.locator('tr', { hasText: '051621002' }).first();
  console.log('ROW BEFORE:', await row.count());
  await row.locator('button').nth(1).click();
  await page.waitForTimeout(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  console.log('MENU DELETE COUNT:', await menuDelete.count());
  await menuDelete.click();
  await page.waitForTimeout(2000);
  console.log('RECEIVED DIALOG VISIBLE:', await page.getByText('Delete a received purchase order?').count());
  const dlg = page.locator('[role="dialog"], [role="alertdialog"]');
  console.log('DIALOG ROLE COUNT:', await dlg.count());
  const dlgDelete = page.getByRole('button', { name: 'Delete', exact: true });
  console.log('DELETE BUTTONS ON PAGE:', await dlgDelete.count());
  await dlgDelete.last().click();
  await page.waitForTimeout(5000);
  console.log('RECEIVED DIALOG STILL VISIBLE:', await page.getByText('Delete a received purchase order?').count());
  const body = await page.locator('body').innerText();
  const toast = body.match(/(deleted|success|failed|error|cannot|unable)[^\n]*/gi);
  console.log('TOAST-LIKE TEXT:', toast ? toast.slice(0, 5) : 'none');
  console.log('ROW AFTER 5s:', await page.locator('tr', { hasText: '051621002' }).count());
  await page.reload();
  await page.getByPlaceholder(/search/i).first().fill('051621002');
  await page.waitForTimeout(2500);
  console.log('ROW AFTER RELOAD:', await page.locator('tr', { hasText: '051621002' }).count());
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
