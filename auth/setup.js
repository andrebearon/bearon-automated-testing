// One-time login, run manually: `npm run auth`
// Opens Chromium, goes to /login, and waits until the console loads
// (URL contains /console). Log in with the TEST account (workspace "Cafe muse2") only.
// It then saves auth/.storage-state.json so later test runs need no login
// and no password. Re-run this whenever the session expires.
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto((process.env.BEARON_BASE_URL || 'https://bearon.studio') + '/login');
  console.log('Log in with the TEST account in the browser window, then wait.');
  console.log('This script saves the session once /console loads, or after 10 minutes.');
  try {
    await page.waitForURL(/\/console/, { timeout: 10 * 60 * 1000 });
  } catch {
    console.error('Timed out waiting for /console. Did the login succeed?');
    process.exit(1);
  }
  await context.storageState({ path: path.join(__dirname, '.storage-state.json') });
  console.log('Saved auth/.storage-state.json');
  await browser.close();
})();
