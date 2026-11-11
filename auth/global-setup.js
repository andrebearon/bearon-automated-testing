// Runs once before the test suite. Makes sure auth/.storage-state.json holds a
// live session: if the file is missing, or /console redirects to the login page
// (expired session), it logs in again with the credentials from .env.
// Without credentials it fails with a clear message instead of every test failing.
const fs = require('fs');
const { chromium } = require('@playwright/test');
const { login, STORAGE_STATE } = require('./env-login');

module.exports = async function globalSetup() {
  if (fs.existsSync(STORAGE_STATE)) {
    const proxy = process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined;
    const browser = await chromium.launch({ headless: true, proxy });
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
      ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY),
    });
    const page = await context.newPage();
    await page.goto((process.env.BEARON_BASE_URL || 'https://bearon.studio') + '/console');
    // The console redirects to /login when the session has expired.
    const loggedIn = await page.waitForURL(/\/console/, { timeout: 30 * 1000 })
      .then(() => page.getByRole('heading', { name: 'Home' }).first().waitFor({ timeout: 30 * 1000 }))
      .then(() => true, () => false);
    await browser.close();
    if (loggedIn) {
      console.log('Auth: saved session is valid.');
      return;
    }
    console.log('Auth: saved session expired, logging in again.');
  } else {
    console.log('Auth: no saved session, logging in.');
  }
  await login();
};
