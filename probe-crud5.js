// Probe 5 (read-only): find ANY delete control for products — list page and
// details page — plus row checkboxes / kebab menus.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto('/console/pos/dashboard/inventory/products/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const listBody = await page.locator('body').innerText();
  console.log('LIST has "delete" text:', /delete/i.test(listBody));
  console.log('LIST has "archive" text:', /archive/i.test(listBody));
  const listBtns = await page.locator('main button, [class*="table"] button, table button').evaluateAll(els =>
    els.map(b => `${(b.innerText || '').trim().slice(0, 30)} [aria=${b.getAttribute('aria-label') || ''} title=${b.getAttribute('title') || ''}]`).filter(Boolean)).catch(() => []);
  console.log('LIST CONTENT BUTTONS:\n' + listBtns.slice(0, 40).join('\n'));
  const checkboxes = await page.locator('input[type="checkbox"]').count();
  console.log('LIST CHECKBOX COUNT:', checkboxes);
  const rowBtns = await page.locator('tr button').evaluateAll(els =>
    els.map(b => (b.innerText || '').trim()).filter(Boolean)).catch(() => []);
  console.log('ROW BUTTONS:', [...new Set(rowBtns)].join(' | '));

  await page.goto('/console/pos/dashboard/inventory/products/details/?productId=357&tab=', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  const detBody = await page.locator('body').innerText();
  console.log('\nDETAILS has "delete" text:', /delete/i.test(detBody));
  console.log('DETAILS has "archive" text:', /archive/i.test(detBody));
  const detBtns = await page.locator('main button').evaluateAll(els =>
    els.map(b => `${(b.innerText || '').trim().slice(0, 40)} [aria=${b.getAttribute('aria-label') || ''}]`).filter(Boolean)).catch(() => []);
  console.log('DETAILS MAIN BUTTONS:\n' + [...new Set(detBtns)].join('\n'));
  // Scroll to bottom — delete is often at the page foot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1500);
  const detBody2 = await page.locator('body').innerText();
  console.log('DETAILS (scrolled) has "delete":', /delete/i.test(detBody2));
  const tail = detBody2.slice(-1500).replace(/\n+/g, ' | ');
  console.log('DETAILS TAIL:', tail);
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
