// One-off cleanup: delete the leftover Received PO #051621002 from
// scenario 4 run 2 (its delete dialog was the received-PO variant the
// helper did not recognise — now fixed). Also verifies the fix works
// on that dialog before the full spec re-run.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await h.deleteByKebab(page, {
    listUrl: '/console/pos/dashboard/inventory/purchase-orders/',
    searchTerm: '051621002', label: 'PO #051621002',
  });
  console.log('CLEANUP-VERIFY OK: leftover Received PO #051621002 deleted');
  await browser.close();
})().catch(e => { console.error('CLEANUP-VERIFY FAIL:', e.message.slice(0, 600)); process.exit(1); });
