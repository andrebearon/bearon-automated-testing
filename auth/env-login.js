// Headless login with the DEMO/test account, saving auth/.storage-state.json.
// Credentials come from BEARON_TEST_EMAIL / BEARON_TEST_PASSWORD, loaded from
// .env (see .env.example) or the shell environment. The password is never
// written to a file or logged.
// Used two ways:
//   - `npm run env-login`  — log in once by hand.
//   - auth/global-setup.js — called before `npm test` when the session is missing or expired.
const { chromium } = require('@playwright/test');
const path = require('path');

const STORAGE_STATE = path.join(__dirname, '.storage-state.json');

async function login() {
  const email = process.env.BEARON_TEST_EMAIL;
  const password = process.env.BEARON_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing BEARON_TEST_EMAIL or BEARON_TEST_PASSWORD. Copy .env.example to .env and fill it in.');
  }
  // PLAYWRIGHT_PROXY is only set on the sandbox VM (scripts/vm/run-tests.sh).
  const proxy = process.env.PLAYWRIGHT_PROXY
    ? { server: process.env.PLAYWRIGHT_PROXY }
    : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY),
    });
    const page = await context.newPage();
    await page.goto((process.env.BEARON_BASE_URL || 'https://bearon.studio') + '/login');

    const emailField = page.getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .or(page.locator('input[type="email"]')).first();
    await emailField.fill(email);
    const passwordField = page.getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .or(page.locator('input[type="password"]')).first();
    await passwordField.fill(password);
    await page.getByRole('button', { name: /sign in|log in|login|masuk/i }).first().click();

    try {
      await page.waitForURL(/\/console/, { timeout: 60 * 1000 });
    } catch {
      const body = await page.locator('body').innerText();
      await page.screenshot({ path: '/tmp/bearon-login-failure.png' }).catch(() => {});
      throw new Error(`Login did not reach /console (URL ${page.url()}). Screenshot: /tmp/bearon-login-failure.png. Page text: ${body.slice(0, 500)}`);
    }
    await context.storageState({ path: STORAGE_STATE });
    console.log('Login OK. Saved auth/.storage-state.json.');
  } finally {
    await browser.close();
  }
}

module.exports = { login, STORAGE_STATE };

if (require.main === module) {
  try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env — rely on the shell env */ }
  login().catch((e) => { console.error(e.message); process.exit(1); });
}
