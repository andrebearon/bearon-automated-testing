// Diagnostic probe for scenario 9/10: open a session on a NON-default
// register (Reg CRUD 27374855U, created by the scenario-9 retry, Closed,
// no session) via the till's "Register: ..." selector, then close it
// again. Verifies the full open/close cycle and the money numbers.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const REG = 'Reg CRUD 27374855U';
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('STATUS BEFORE:', await h.registerStatus(page, REG));
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  // The till's Register selector is a button[role=combobox] with visible
  // text "Default" (top bar: Location | Cafe muse2 | Register | Default),
  // but its ACCESSIBLE name is not "Default" (getByRole combobox finds
  // 0) — so use the CSS role selector: the 2nd combobox on the till
  // (1st is Location). Log both combobox texts first.
  const combos = page.locator('button[role="combobox"]');
  const comboTexts = await combos.allInnerTexts();
  console.log('TILL COMBOBOXES:', JSON.stringify(comboTexts));
  const sel = combos.nth(1);
  console.log('REGISTER SELECTOR TEXT:', (await sel.innerText()).replace(/\n/g, ' '));
  await sel.click();
  await page.waitForTimeout(2000);
  const menuText = await page.locator('body').innerText();
  const opts = [...new Set((menuText.match(/Reg CRUD \d+U|Default/g) || []))];
  console.log('MENU OPTIONS VISIBLE:', JSON.stringify(opts));
  // Click the menu option for our register (try option, menuitem, button).
  const opt = page.getByRole('option', { name: REG }).first();
  console.log('OPTION COUNT:', await opt.count());
  if (await opt.count()) await opt.click({ timeout: 15000 });
  else {
    const mi = page.getByRole('menuitem', { name: REG }).first();
    console.log('MENUITEM COUNT:', await mi.count());
    if (await mi.count()) await mi.click({ timeout: 15000 });
    else {
      const btn = page.getByRole('button', { name: REG }).first();
      console.log('BUTTON-ROLE COUNT:', await btn.count());
      await btn.click({ timeout: 15000 });
    }
  }
  await page.waitForTimeout(3000);
  const sel2 = await page.locator('button[role="combobox"]').nth(1).innerText().catch(() => '?');
  console.log('SELECTOR AFTER PICK:', sel2.replace(/\n/g, ' '));
  // Now the Open Register dialog should show (register is Closed).
  const openBtn = page.getByRole('button', { name: 'Open Register' });
  console.log('OPEN REGISTER BUTTON COUNT:', await openBtn.count());
  if (await openBtn.count()) {
    const zero = page.getByRole('button', { name: '0', exact: true }).first();
    if (await zero.count()) await zero.click();
    await openBtn.first().click();
    await page.waitForTimeout(3000);
    console.log('OPEN CLICKED');
  }
  console.log('STATUS AFTER OPEN ATTEMPT:', await h.registerStatus(page, REG));
  // Close it again (closing cash should be Rp0 = expected, no sales).
  const closed = await h.closeRegisterSession(page, REG);
  console.log('CLOSED: expectedCash Rp' + closed.expectedCash);
  console.log('STATUS AFTER CLOSE:', await h.registerStatus(page, REG));
  console.log('DEFAULT STATUS:', await h.registerStatus(page, 'Default'));
  await browser.close();
  console.log('PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
