// Probe: verify state after scenario-10 retry was killed by the exec
// timeout (EXIT 124) mid-run. Checks: Mix Reg 46409198 status, OM
// statuses of CEE-51020/51021/51022, whether a pending order was saved,
// then closes Mix Reg 46409198 (scenario 10's own register) with
// closing cash = expected, logging the close-panel numbers.
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  console.log('MIX REG STATUS:', await h.registerStatus(page, 'Mix Reg 46409198'));
  console.log('DEFAULT STATUS:', await h.registerStatus(page, 'Default'));
  for (const ref of ['CEE-51020', 'CEE-51021', 'CEE-51022']) {
    try {
      await h.openOrderDetails(page, ref);
      const t = await page.locator('body').innerText();
      const st = /Voided/.test(t) ? 'Voided' : /Refunded/.test(t) ? 'Refunded' : /Paid/.test(t) ? 'Paid' : 'UNKNOWN';
      const tot = (t.match(/Total\s*Rp([\d.,]+)/) || [])[1] || '?';
      console.log(`ORDER ${ref}: status=${st} total=Rp${tot}`);
    } catch (e) { console.log(`ORDER ${ref}: CHECK FAILED:`, e.message.slice(0, 150)); }
  }
  // Pending tab: any new pending order?
  await page.goto('/console/pos/dashboard/pos/order-management/');
  await sleep(3000);
  await page.getByRole('button', { name: /pending orders/i }).first().click({ timeout: 15000 });
  await sleep(3000);
  const pendBody = await page.locator('body').innerText();
  console.log('PENDING REFS NOW:', (pendBody.match(/PCEE-\d+/g) || []).join(', ') || 'none');
  // Close Mix Reg 46409198 (own register) if still Open.
  const st = await h.registerStatus(page, 'Mix Reg 46409198');
  if (st === 'Open') {
    const fin = await h.closeRegisterSession(page, 'Mix Reg 46409198');
    console.log(`CLOSED Mix Reg 46409198: Expected Cash Rp${fin.expectedCash} :: ${(fin.panelText.match(/Cash Sales\s*Rp[\d.,]+/) || ['?'])[0]} :: ${(fin.panelText.match(/Total Takings\s*Rp[\d.,]+/) || ['?'])[0]}`);
  } else {
    console.log('Mix Reg 46409198 already', st, '- no close needed');
  }
  await browser.close();
  console.log('STATE PROBE DONE');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
