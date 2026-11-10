const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  const was = await h.setKitchenTickets(page, true);
  // Read both switches by row label, row-scoped.
  const states = await page.evaluate(() => {
    const read = (label) => {
      for (const sw of document.querySelectorAll('[role="switch"]')) {
        let el = sw;
        for (let up = 0; up < 8 && el; up++) {
          const t = el.innerText || '';
          if (t.includes(label) && t.length < 200) return sw.getAttribute('aria-checked') === 'true';
          el = el.parentElement;
        }
      }
      return null;
    };
    return { kitchen: read('Show orders on a kitchen screen'), price: read('Allow staff to change the price') };
  });
  console.log('AFTER setKitchenTickets(true): was=', was, 'states=', JSON.stringify(states));
  await h.setKitchenTickets(page, false);
  const back = await page.evaluate(() => {
    for (const sw of document.querySelectorAll('[role="switch"]')) {
      let el = sw;
      for (let up = 0; up < 8 && el; up++) {
        const t = el.innerText || '';
        if (t.includes('Show orders on a kitchen screen') && t.length < 200) return sw.getAttribute('aria-checked') === 'true';
        el = el.parentElement;
      }
    }
    return null;
  });
  console.log('RESTORED kitchen OFF:', back === false);
  await browser.close();
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 400)); process.exit(1); });
