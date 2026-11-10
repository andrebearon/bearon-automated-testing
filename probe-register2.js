const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/cash-register/');
  await page.getByRole('button', { name: 'Create Cash Register' }).click();
  await page.waitForTimeout(2000);
  console.log('=== CREATE DIALOG ===');
  console.log((await page.locator('body').innerText()).slice(0, 1800));
  console.log('INPUTS:', JSON.stringify(await page.locator('input').evaluateAll(els => els.map(e => ({ name: e.getAttribute('name'), placeholder: e.getAttribute('placeholder'), type: e.type })))));
  console.log('SELECTS:', JSON.stringify(await page.locator('select').evaluateAll(els => els.map(e => ({ name: e.getAttribute('name'), options: [...e.options].map(o => o.text) })))));
  // Cancel / close the dialog without creating.
  const cancel = page.getByRole('button', { name: /cancel/i }).first();
  if (await cancel.count()) { await cancel.click(); } else { await page.keyboard.press('Escape'); }
  await page.waitForTimeout(1500);
  // Manage menu for Default register.
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.waitForTimeout(1500);
  console.log('=== MANAGE MENU ===');
  console.log((await page.locator('body').innerText()).slice(0, 1200));
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
