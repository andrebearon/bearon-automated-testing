// Order Management helpers: find an order by ref and open its details.
// The list defaults to a date range; if the order is outside it, the search
// widens the range once via a preset before failing.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

async function findOrderInOM(page, ref) {
  await page.goto(URLS.orderManagement);
  const search = page.getByPlaceholder(/search orders by refno/i).first();
  await search.fill(ref);
  await page.keyboard.press('Enter');
  try {
    await expect(page.getByText(ref).first()).toBeVisible({ timeout: 30000 });
    return;
  } catch {
    console.log(`OM: ${ref} not in default date range; trying a wider range`);
  }
  const rangeBtn = page.getByRole('button', { name: /\d{4}\s*-/ }).first();
  if (await rangeBtn.count()) {
    await rangeBtn.click();
    await sleep(1500);
    const preset = page.getByRole('button', { name: /all time|last 90 days|this year|last 30 days/i }).first();
    if (await preset.count()) {
      await preset.click();
      await sleep(1500);
      await search.fill(ref);
      await page.keyboard.press('Enter');
      await expect(page.getByText(ref).first()).toBeVisible({ timeout: 30000 });
      return;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error(`Order not found in Order Management: ${ref}`);
}

async function openOrderDetails(page, ref) {
  await findOrderInOM(page, ref);
  await page.getByText(ref).first().click();
  await expect(page.getByText(`Reference: #${ref}`).first()).toBeVisible({ timeout: 30000 });
}

module.exports = { findOrderInOM, openOrderDetails };
