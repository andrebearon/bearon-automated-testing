// Bearon core-flow automated test — NOT a product audit.
// Purpose: fast, deterministic pass/fail for flows whose UX will not change,
// replacing screenshot-by-screenshot AI checking for those flows only.
// No AI, no screenshots in the loop: Playwright asserts on DOM text/values
// and exits non-zero on failure. Trace/screenshot only on failure, for debugging.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // 120s was too short through the VM proxy: each Bearon navigation
  // takes 10–20s, and the full flow (category, product, till, orders,
  // details) exceeds it. 300s gives the flow room without masking a
  // genuinely stuck step, which still fails on its own locator timeout.
  timeout: 300 * 1000,
  expect: { timeout: 30 * 1000 },
  fullyParallel: false,
  workers: 1, // single worker: the Muse cafe test workspace is shared
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BEARON_BASE_URL || 'https://bearon.studio',
    // Proxy: only when PLAYWRIGHT_PROXY is set (see run-test.sh for the VM).
    // On a normal machine, leave it unset and Playwright connects directly.
    // In this VM, the cell egress proxy re-signs TLS with its own
    // "Hatch Sandbox Egress CA" (curl trusts it via a custom bundle;
    // Chromium does not), so a local CONNECT proxy (local-proxy.js)
    // is used AND certificate validation is skipped for that run only.
    // Traffic is still encrypted to the egress proxy; skipping validation
    // here means accepting the proxy's re-signed certificate, which is
    // why this is a test-account-only setting, never for real accounts.
    proxy: process.env.PLAYWRIGHT_PROXY
      ? { server: process.env.PLAYWRIGHT_PROXY }
      : undefined,
    ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY),
    // Auth: run `npm run auth` once first. It opens a browser, you log in
    // with the TEST account only, and it saves auth/.storage-state.json.
    // No password lives in this repo, in code, or in git history.
    storageState: 'auth/.storage-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
