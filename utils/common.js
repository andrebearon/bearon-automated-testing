// Generic helpers with no business context: waits, unique run names,
// best-effort cleanup and the list-row kebab delete used by most list pages.
const { expect } = require('@playwright/test');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 8-digit suffix so every record a run creates has a unique name.
const runSuffix = () => Date.now().toString().slice(-8);

// Today as DD/MM/YYYY, the format used by the cash register logs.
function todayDdMmYyyy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Logs and never throws, so cleanup can never fail a test.
async function bestEffort(label, fn) {
  try {
    const result = await fn();
    console.log(`CLEANUP OK: ${label}`);
    return result;
  } catch (e) {
    console.log(`CLEANUP SKIPPED: ${label}: ${e.message}`);
    return null;
  }
}

// Delete a row via its kebab menu (View / Delete), then verify it is gone from
// a fresh search. Throws on failure; wrap in bestEffort() for cleanup.
// kebabIndex: which row button is the kebab — 1 on most lists (products,
// categories, suppliers, POs), 2 on the customers list (button 1 there is
// "Open customer"). FIX (12 Nov 2026): the else branch used to click an
// exact-text "Delete" with no timeout bound, burning the whole test timeout
// when no such text existed (spec 13 run 2) — it now fails fast instead.
async function deleteByKebab(page, { listUrl, searchTerm, label, kebabIndex = 1 }) {
  await page.goto(listUrl);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill(searchTerm);
  await sleep(2000);
  const row = page.locator('tr', { hasText: searchTerm }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.locator('button').nth(kebabIndex).click();
  await sleep(1200);
  const menuDelete = page.getByRole('menuitem', { name: /delete/i }).first();
  if (await menuDelete.count()) {
    await menuDelete.click();
  } else {
    await expect(page.getByText('Delete', { exact: true }).last())
      .toBeVisible({ timeout: 15000 });
    await page.getByText('Delete', { exact: true }).last().click();
  }
  // The confirm dialog renders async; a Received PO shows a different title.
  let confirmed = false;
  for (let i = 0; i < 60; i++) {
    const generic = await page.getByText('Delete Confirmation').first().count();
    const received = await page.getByText('Delete a received purchase order?').first().count();
    if (generic || received) {
      const dlg = page.locator('[role="dialog"], [role="alertdialog"]');
      const dlgDelete = dlg.getByRole('button', { name: 'Delete', exact: true }).first();
      if (await dlgDelete.count()) await dlgDelete.click();
      else await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      confirmed = true;
      break;
    }
    if ((await page.locator('tr', { hasText: searchTerm }).count()) === 0) break;
    await sleep(500);
  }
  console.log(`DELETE ${confirmed ? 'CONFIRMED' : 'no dialog seen'}: ${label}`);
  // Wait for the row to vanish before navigating, or the delete request can be aborted.
  await expect(page.locator('tr', { hasText: searchTerm })).toHaveCount(0, { timeout: 30000 });
  await page.goto(listUrl);
  await sleep(2500);
  const search2 = page.getByPlaceholder(/search/i).first();
  await search2.fill(searchTerm);
  await sleep(2000);
  await expect(page.locator('tr', { hasText: searchTerm })).toHaveCount(0, { timeout: 30000 });
  console.log(`DELETED: ${label}`);
}

module.exports = { sleep, runSuffix, todayDdMmYyyy, bestEffort, deleteByKebab };
