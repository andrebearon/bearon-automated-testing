// Diagnostic probe: open Default via the Cash Registers page "Open session"
// button (row now shows it — contradicts the 6 Nov scenario-9 finding).
// Prints version, what happens after the click, and the final status.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  const body0 = await page.locator('body').innerText();
  console.log('VERSION:', (body0.match(/v\d+\.\d+\.\d+/) || ['?'])[0]);
  await page.goto('/console/pos/dashboard/pos/cash-register/');
  await page.waitForTimeout(3000);
  const row = page.locator('tr', { hasText: 'Default' }).first();
  console.log('ROW BEFORE:', (await row.innerText()).replace(/\n/g, ' | '));
  const openBtn = row.getByRole('button', { name: 'Open session' });
  console.log('OPEN SESSION BUTTON COUNT:', await openBtn.count());
  if (await openBtn.count()) {
    await openBtn.first().click();
    await page.waitForTimeout(4000);
    const t = await page.locator('body').innerText();
    console.log('AFTER CLICK URL:', page.url());
    console.log('AFTER CLICK SNIPPET:', (t.match(/(Open Cash Register|Open Register|Opening Float|Register:[\s\S]{0,300})/) || ['<no open panel text>'])[0].replace(/\n+/g, ' | ').slice(0, 600));
    // If an open-register panel/dialog appeared, enter float 0 via keypad quirk and confirm.
    const confirm = page.getByRole('button', { name: /^Open Register$/ });
    if (await confirm.count()) {
      const zero = page.getByRole('button', { name: '0', exact: true }).first();
      if (await zero.count()) await zero.click();
      await confirm.first().click();
      await page.waitForTimeout(3000);
      console.log('CONFIRMED OPEN, URL NOW:', page.url());
    } else {
      console.log('NO Open Register confirm button visible after click');
    }
  }
  await page.goto('/console/pos/dashboard/pos/cash-register/');
  await page.waitForTimeout(3000);
  const row2 = page.locator('tr', { hasText: 'Default' }).first();
  console.log('ROW AFTER:', (await row2.innerText()).replace(/\n/g, ' | '));
  const status = await h.registerStatus(page, 'Default');
  console.log('DEFAULT STATUS:', status);
  if (status === 'Open') console.log('DEFAULT REOPENED OK');
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 500)); process.exit(1); });
