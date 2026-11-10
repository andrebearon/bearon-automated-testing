// Diagnostic probe: replicate helpers.openRegisterSession step by step
// on Reg CRUD 27832311U (leftover from scenario-9 run 3, Closed),
// logging the till state after each step. Closes the register at the
// end if it opened.
const { chromium, expect } = require('@playwright/test');
const h = require('./tests/helpers');
const REG = 'Reg CRUD 27832311U';
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('STATUS BEFORE:', await h.registerStatus(page, REG));
  await page.goto('/console/pos/dashboard/pos/sales/');
  await page.waitForTimeout(3000);
  const combos = page.locator('button[role="combobox"]');
  console.log('COMBOBOXES:', JSON.stringify(await combos.allInnerTexts()));
  await combos.nth(1).click();
  await h.sleep(1500);
  const opt = page.getByRole('option', { name: REG }).first();
  console.log('OPTION VISIBLE:', await opt.isVisible().catch(() => false));
  await opt.click({ timeout: 15000 });
  await h.sleep(2000);
  console.log('SELECTOR AFTER PICK:', (await combos.nth(1).innerText()).replace(/\n/g, ' '));
  const openBtn = page.getByRole('button', { name: 'Open Register' });
  console.log('OPEN REGISTER COUNT:', await openBtn.count());
  console.log('OPEN REGISTER VISIBLE:', await openBtn.first().isVisible().catch(() => false));
  const tillText = await page.locator('body').innerText();
  console.log('TILL HAS Open Cash Register:', /Open Cash Register/.test(tillText), '| HAS Open Register:', /Open Register/.test(tillText));
  console.log('TILL TEXT SNIPPET:', tillText.replace(/\n+/g, ' | ').slice(0, 800));
  if (await openBtn.count()) {
    const zero = page.getByRole('button', { name: '0', exact: true }).first();
    console.log('KEYPAD 0 COUNT:', await zero.count());
    if (await zero.count()) await zero.click();
    await openBtn.first().click();
    await page.waitForTimeout(3000);
    console.log('OPEN CLICKED; OPEN BTN COUNT NOW:', await page.getByRole('button', { name: 'Open Register' }).count());
  }
  console.log('STATUS AFTER:', await h.registerStatus(page, REG));
  if ((await h.registerStatus(page, REG)) === 'Open') {
    const c = await h.closeRegisterSession(page, REG);
    console.log('CLOSED AGAIN, expectedCash Rp' + c.expectedCash);
  }
  console.log('DEFAULT STATUS:', await h.registerStatus(page, 'Default'));
  await browser.close();
  console.log('PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
