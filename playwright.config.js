// Playwright config for the Bearon core-flow e2e suite. See README.md.
// Deterministic pass/fail on DOM text/values; trace + screenshot only on failure.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test-cases',
  // Each Bearon navigation can take 10–20s; most tests raise this with test.setTimeout().
  timeout: 300 * 1000,
  expect: { timeout: 30 * 1000 },
  // Single worker: every test shares the one "Cafe muse2" demo workspace.
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BEARON_BASE_URL || 'https://bearon.studio',
    // Only set by scripts/vm/run-tests.sh. The VM egress proxy re-signs TLS,
    // so certificate errors are ignored for that run only (test account only).
    proxy: process.env.PLAYWRIGHT_PROXY
      ? { server: process.env.PLAYWRIGHT_PROXY }
      : undefined,
    ignoreHTTPSErrors: Boolean(process.env.PLAYWRIGHT_PROXY),
    // Saved login session from `npm run auth` / `npm run env-login`. Never commit it.
    storageState: 'auth/.storage-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
