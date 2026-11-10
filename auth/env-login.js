// One-time login using credentials passed ONLY as environment variables:
//   BEARON_TEST_EMAIL, BEARON_TEST_PASSWORD
// Usage: BEARON_TEST_EMAIL=... BEARON_TEST_PASSWORD=... node auth/env-login.js
// The password is never written to a file, to the repo, or to logs.
// This script logs in once with the DEMO/test account only, waits for
// /console, and saves auth/.storage-state.json. After that, `npm test`
// reuses the session and the password is no longer needed — clear the
// environment variables as soon as this script exits.
// Do NOT use a real/main account here. Demo/test account only.
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const email = process.env.BEARON_TEST_EMAIL;
  const password = process.env.BEARON_TEST_PASSWORD;
  if (!email || !password) {
    console.error('Missing BEARON_TEST_EMAIL or BEARON_TEST_PASSWORD in the environment.');
    process.exit(1);
  }
  // Proxy: PLAYWRIGHT_PROXY when set (VM: local-proxy.js, see README).
  // Otherwise no proxy (normal machine). ignoreHTTPSErrors mirrors the
  // config: only when the VM egress proxy re-signs TLS certificates.
  const proxy = process.env.PLAYWRIGHT_PROXY
    ? { server: process.env.PLAYWRIGHT_PROXY }
    : undefined;
  const browser = await chromium.launch({ headless: true, proxy });
  const context = await browser.newContext({
    ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY),
  });
  const page = await context.newPage();
  await page.goto((process.env.BEARON_BASE_URL || 'https://bearon.studio') + '/login');

  // Fill the login form with resilient locators (label, placeholder, type).
  const emailField = page.getByLabel(/email/i)
    .or(page.getByPlaceholder(/email/i))
    .or(page.locator('input[type="email"]')).first();
  await emailField.fill(email);

  const passwordField = page.getByLabel(/password/i)
    .or(page.getByPlaceholder(/password/i))
    .or(page.locator('input[type="password"]')).first();
  await passwordField.fill(password);

  const submit = page.getByRole('button', { name: /sign in|log in|login|masuk/i }).first();
  await submit.click();

  try {
    await page.waitForURL(/\/console/, { timeout: 60 * 1000 });
  } catch {
    const body = await page.locator('body').innerText();
    console.error('Login did not reach /console. URL:', page.url());
    console.error('Page text:', body.slice(0, 2000));
    try { await page.screenshot({ path: '/tmp/bearon-login-failure.png' }); console.error('Screenshot: /tmp/bearon-login-failure.png'); } catch {}
    process.exit(1);
  }
  fs.mkdirSync(path.join(__dirname), { recursive: true });
  await context.storageState({ path: path.join(__dirname, '.storage-state.json') });
  console.log('Login OK. Saved auth/.storage-state.json. Clear the env vars now.');
  await browser.close();
})();
