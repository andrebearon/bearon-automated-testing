// Kitchen display board helpers.
// Kitchen tickets are OFF by default: turn them on with
// setPosFeature(page, POS_FEATURES.kitchenTickets, true) and restore afterwards.
// The board refreshes on a ~60s poll, so every check here polls + reloads.
// Card actions: Start Preparing -> Mark Ready -> Mark Completed.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

async function openKitchenBoard(page) {
  await page.goto(URLS.kitchenBoard);
  await expect(page.getByText('Not started').first()).toBeVisible({ timeout: 30000 });
}

async function waitForOrderOnBoard(page, ref, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await page.getByText(ref).first().count()) return true;
    console.log(`BOARD POLL ${attempt}: ${ref} not on board yet, reloading…`);
    await sleep(20000);
    await page.reload();
    await page.waitForTimeout(3000);
  }
  throw new Error(`Order ${ref} did not appear on the kitchen board within ${timeoutMs / 1000}s`);
}

// Click an action on the order's card, then poll until the card offers nextAction
// (or, when nextAction is null, until Completed Orders count is >= 1).
async function progressKitchenOrder(page, ref, action, nextAction) {
  const card = page.locator('div', { hasText: ref }).filter({ has: page.getByRole('button', { name: action }) }).last();
  await expect(card.getByRole('button', { name: action }).first()).toBeVisible({ timeout: 60000 });
  await card.getByRole('button', { name: action }).first().click();
  await sleep(3000);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await page.reload();
    await page.waitForTimeout(3000);
    if (nextAction) {
      const next = page.locator('div', { hasText: ref }).filter({ has: page.getByRole('button', { name: nextAction }) }).last();
      if (await next.count()) return;
    } else if (await page.getByText(/Completed Orders \([1-9]/).first().count()) {
      return;
    }
    await sleep(15000);
  }
  throw new Error(`Kitchen order ${ref} did not move after "${action}" within 120s`);
}

module.exports = { openKitchenBoard, waitForOrderOnBoard, progressKitchenOrder };
