const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:8888' } });
  const page = await (await browser.newContext()).newPage();
  try { await page.goto('https://example.com', { timeout: 30000 }); console.log('via local proxy OK', await page.title()); } catch(e) { console.log('via local proxy FAIL', e.message.split('\n')[0]); }
  await browser.close();
})();
