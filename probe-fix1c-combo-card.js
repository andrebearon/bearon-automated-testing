// Probe fix-1c: inspect the "Stock per combination" card fully —
// switches, inputs, buttons inside it; click anything toggle-like and
// re-dump. Does NOT save.
const { chromium } = require('@playwright/test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const h = require('./tests/helpers');

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const ctx = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/inventory/products/');
  await page.getByRole('button', { name: 'Add Product' }).click();
  await sleep(3000);
  await h.fillProductGeneral(page, { name: 'Probe Prod X', category: 'Auto Category', price: 10000, description: 'probe only' });
  await h.fillProductOptions(page, { group: 'Size', values: [{ name: 'Regular', charge: 0 }, { name: 'Large', charge: 5000 }] });
  await sleep(1500);
  const cardInfo = await page.evaluate(() => {
    const title = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Stock per combination');
    if (!title) return 'TITLE NOT FOUND';
    // walk up to the card (rounded-xl border bg-card)
    let card = title;
    for (let i = 0; i < 6 && card.parentElement; i++) {
      card = card.parentElement;
      if (/rounded-xl/.test(card.className) && /bg-card/.test(card.className)) break;
    }
    const desc = (el) => ({ tag: el.tagName, role: el.getAttribute('role'), type: el.getAttribute('type'), text: (el.innerText || el.textContent || '').trim().slice(0, 100), checked: el.checked, ariaChecked: el.getAttribute('aria-checked'), cls: String(el.className).slice(0, 60) });
    return {
      cardClass: String(card.className).slice(0, 120),
      htmlLen: card.innerHTML.length,
      html: card.innerHTML.slice(0, 8000),
      buttons: [...card.querySelectorAll('button')].map(desc),
      inputs: [...card.querySelectorAll('input')].map(desc),
      switches: [...card.querySelectorAll('[role="switch"]')].map(desc),
    };
  });
  console.log('CARD INFO:', JSON.stringify(cardInfo, null, 1));
  // Any switch anywhere on the page?
  console.log('PAGE SWITCHES:', await page.getByRole('switch').count());
  const sw = page.getByRole('switch');
  for (let i = 0; i < await sw.count(); i++) {
    console.log(`SWITCH ${i}:`, await sw.nth(i).evaluate(e => ({ label: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), text: (e.closest('div')?.innerText || '').slice(0, 120) })));
  }
  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
