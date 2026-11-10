// Read-only workspace check: open /console with saved session, print workspace name.
// No state is created. Uses storageState only — no credentials.
const { chromium } = require('@playwright/test');
(async () => {
  const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const ctx = await browser.newContext({ storageState: 'auth/.storage-state.json', ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY) });
  const page = await ctx.newPage();
  await page.goto('https://bearon.studio/console', { timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  const body = await page.locator('body').innerText();
  console.log('BODY-SNIPPET:', body.slice(0, 1200).replace(/\n+/g, ' | '));
  console.log('HAS-Cafe-muse2:', /Cafe muse2/.test(body));
  console.log('HAS-Muse-cafe:', /Muse cafe/.test(body));
  console.log('HAS-Welcome-Back:', /Welcome Back/.test(body));
  await browser.close();
})().catch(e => { console.error('PROBE-FAILED:', e.message); process.exit(1); });
