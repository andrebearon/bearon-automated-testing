// Diagnostic probe for scenario 12: drag across empty cells to add a
// table (page hint: "Tap or drag across empty cells to add a table").
// Finds the grid, drags across 2 cells, logs what appears. Does NOT
// save (Escape any dialog; no Save click).
const { chromium } = require('@playwright/test');
const h = require('./tests/helpers');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({ baseURL: 'https://bearon.studio', storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await context.newPage();
  await h.ensureWorkspace(page);
  await page.goto('/console/pos/dashboard/pos/pos-settings/business-layout/');
  await page.waitForTimeout(4000);
  // Find the grid: the element whose children form the 5x5 cells.
  const gridBox = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter(d => {
      const cs = getComputedStyle(d);
      return cs.display === 'grid' && d.children.length >= 10;
    }).map(d => {
      const r = d.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, kids: d.children.length, cls: (d.className || '').toString().slice(0, 80) };
    });
    return cands;
  });
  console.log('GRID CANDIDATES:', JSON.stringify(gridBox));
  if (!gridBox.length) { console.log('NO GRID FOUND'); await browser.close(); return; }
  const g = gridBox[0];
  const cw = g.w / 5, ch = g.h / 5;
  const x0 = g.x + cw * 0.5, y0 = g.y + ch * 0.5;
  const x1 = g.x + cw * 1.5, y1 = y0;
  console.log(`DRAG from (${x0.toFixed(0)},${y0.toFixed(0)}) to (${x1.toFixed(0)},${y1.toFixed(0)})`);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const t = await page.locator('body').innerText();
  console.log('AFTER DRAG (first 1200 chars):', t.replace(/\n+/g, ' | ').slice(0, 1200));
  console.log('DIALOGS:', await page.locator('[role="dialog"]').count());
  const dlgText = await page.locator('[role="dialog"]').first().innerText().catch(() => '<none>');
  console.log('DIALOG TEXT:', dlgText.replace(/\n+/g, ' | ').slice(0, 600));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await browser.close();
  console.log('PROBE DONE (no changes saved)');
})().catch(e => { console.error('PROBE-FAIL:', e.message.slice(0, 600)); process.exit(1); });
