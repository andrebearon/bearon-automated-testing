import { chromium } from '@playwright/test';
const t0 = Date.now();
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  await browser.close();
  console.log('OK ' + ((Date.now() - t0) / 1000).toFixed(2) + 's');
} catch (e) {
  console.log('FAIL ' + String(e && e.message ? e.message : e).split('\n')[0]);
  process.exit(1);
}
