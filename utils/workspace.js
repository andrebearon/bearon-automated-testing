// Workspace guard and workspace-level settings.
// ensureWorkspace() must be the first call of every test case: it aborts the
// run unless the console is on the demo workspace, so nothing ever writes to
// a real or audit workspace.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { WORKSPACE, URLS } = require('./constants');

async function ensureWorkspace(page) {
  await page.goto(URLS.console);
  await expect(page.getByRole('heading', { name: 'Home' }).first())
    .toBeVisible({ timeout: 30000 });
  const body = await page.locator('body').innerText();
  if (!body.includes(WORKSPACE)) {
    throw new Error(`ABORT: console is not on the "${WORKSPACE}" demo workspace`);
  }
}

// Toggle a switch in Settings > Features > POS by its label. Returns the previous state.
// The row must be short (< 200 chars) or the whole settings card matches every label.
async function setPosFeature(page, label, on) {
  await page.goto(URLS.posFeatures);
  await page.locator('[role="switch"]').first().waitFor({ timeout: 30000 });
  const found = await page.evaluate((label) => {
    const switches = [...document.querySelectorAll('[role="switch"]')];
    for (let i = 0; i < switches.length; i++) {
      let el = switches[i];
      for (let up = 0; up < 8 && el; up++) {
        const text = el.innerText || '';
        if (text.includes(label) && text.length < 200) {
          return { index: i, checked: switches[i].getAttribute('aria-checked') === 'true' };
        }
        el = el.parentElement;
      }
    }
    return null;
  }, label);
  if (!found) throw new Error(`POS feature switch not found: ${label}`);
  if (found.checked !== on) {
    await page.locator('[role="switch"]').nth(found.index).click();
    await sleep(2000);
  }
  console.log(`POS FEATURE "${label}": was ${found.checked ? 'ON' : 'OFF'}, set to ${on ? 'ON' : 'OFF'}`);
  return found.checked;
}

module.exports = { ensureWorkspace, setPosFeature };
