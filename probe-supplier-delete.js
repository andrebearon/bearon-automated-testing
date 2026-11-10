// Reproduce the supplier kebab-delete flow step by step on the leftover
// supplier "Test Supp 71605252" (spec 3 run 1 left it: delete verification
// failed, supplier still listed). Dump the menu DOM and any confirm
// dialog at each step, then complete the delete and verify it is gone.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

const SUPPLIER = 'Test Supp 71605252';

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const search = page.getByPlaceholder(/search/i).first();
  console.log('SEARCH PLACEHOLDER:', await search.getAttribute('placeholder'));
  await search.fill(SUPPLIER);
  await sleep(2000);
  const row = page.locator('tr', { hasText: SUPPLIER }).first();
  console.log('ROW FOUND:', await row.count());
  const rowBtns = row.locator('button');
  console.log('ROW BUTTON COUNT:', await rowBtns.count());
  for (let i = 0; i < await rowBtns.count(); i++) {
    console.log(` row button[${i}] text=${JSON.stringify(await rowBtns.nth(i).innerText().catch(() => '?'))} role=${await rowBtns.nth(i).getAttribute('role').catch(() => '')}`);
  }
  await rowBtns.nth(1).click();
  await sleep(1500);
  console.log('MENUITEM delete count:', await page.getByRole('menuitem', { name: /delete/i }).count());
  console.log('BUTTON delete count:', await page.getByRole('button', { name: /delete/i }).count());
  console.log('TEXT Delete exact count:', await page.getByText('Delete', { exact: true }).count());
  const menuItems = await page.getByRole('menuitem').allInnerTexts().catch(() => []);
  console.log('ALL MENUITEMS:', JSON.stringify(menuItems));
  // Dump the menu container HTML (last 1500 chars of body around "Delete")
  const body1 = await page.locator('body').innerText();
  const idx = body1.lastIndexOf('Delete');
  console.log('BODY AROUND LAST Delete:', JSON.stringify(body1.slice(Math.max(0, idx - 300), idx + 300)));
  // Click Delete via menuitem if present, else text
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    console.log('CLICKING menuitem Delete');
    await menuDelete.click();
  } else {
    console.log('CLICKING text Delete (last)');
    await page.getByText('Delete', { exact: true }).last().click();
  }
  await sleep(1000);
  console.log('--- 1s AFTER DELETE CLICK ---');
  console.log('DIALOG count:', await page.locator('[role="dialog"], [role="alertdialog"]').count());
  console.log('BUTTONS:', JSON.stringify((await page.getByRole('button').allInnerTexts().catch(() => [])).filter(t => t.trim()).slice(-15)));
  console.log('BODY TAIL:', (await page.locator('body').innerText()).slice(-1200).replace(/\n+/g, ' | '));
  await sleep(2500);
  console.log('--- 3.5s AFTER DELETE CLICK ---');
  console.log('DIALOG count:', await page.locator('[role="dialog"], [role="alertdialog"]').count());
  console.log('BUTTONS tail:', JSON.stringify((await page.getByRole('button').allInnerTexts().catch(() => [])).filter(t => t.trim()).slice(-15)));
  console.log('BODY TAIL:', (await page.locator('body').innerText()).slice(-1200).replace(/\n+/g, ' | '));
  // Confirm if a dialog/button offers it
  const confirm = page.getByRole('button', { name: /^delete$/i }).first();
  console.log('CONFIRM Delete button count:', await confirm.count());
  if (await confirm.count()) {
    console.log('CLICKING confirm Delete');
    await confirm.click();
    await sleep(3000);
    console.log('AFTER CONFIRM BODY TAIL:', (await page.locator('body').innerText()).slice(-800).replace(/\n+/g, ' | '));
  }
  // Verify gone
  await page.goto('/console/pos/dashboard/inventory/suppliers/', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const s2 = page.getByPlaceholder(/search/i).first();
  await s2.fill(SUPPLIER);
  await sleep(2000);
  console.log('ROW STILL PRESENT AFTER ALL THIS:', await page.locator('tr', { hasText: SUPPLIER }).count());
  console.log('PROBE-DELETE DONE');
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
