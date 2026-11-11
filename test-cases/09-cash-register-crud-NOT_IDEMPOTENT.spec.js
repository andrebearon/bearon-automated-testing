/**
 * Scenario 09 — CRUD cash register
 *
 * Flow:
 *   1. Create a NEW register (location "Cafe muse2"), verify it is Closed.
 *   2. Rename it via Manage, verify the old name is gone.
 *   3. Open a session on it from the till's Register selector.
 *   4. Verify today's session appears in All Logs.
 *   5. Close the session with closing cash = expected cash (Rp0, no sales).
 *   6. Look for a Delete control (none known) — delete if found, else log.
 *   7. Guard: the "Default" register is still Open and untouched.
 *
 * Data:    "Reg CRUD <suffix>" renamed to "Reg CRUD <suffix>U".
 * Cleanup: none possible — registers have no Delete control; one Closed register per run remains.
 * Known:   Flaky at step 3 (till register pick sometimes does not apply,
 *          an overlay can block the retry). See docs/results/.
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const REG = `Reg CRUD ${suffix}`;
const REG_U = `${REG}U`;
const todayStr = h.todayDdMmYyyy();

test('cash register CRUD: create, rename, open session, read logs, close session', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create a new register -------------------------------------------
  await page.goto(h.URLS.cashRegisters);
  await page.getByRole('button', { name: 'Create Cash Register' }).click();
  await expect(page.getByText('Add New Cash Register')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(REG);
  await page.locator('input[name="description"]').fill(`Cash register test ${suffix}`);
  // Location is required and starts empty; pick the select that offers the workspace.
  const selects = page.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const opts = await selects.nth(i).locator('option').allInnerTexts();
    if (opts.includes(h.WORKSPACE)) await selects.nth(i).selectOption({ label: h.WORKSPACE });
  }
  const addBtn = page.getByRole('button', { name: 'Add Cash Register' });
  await expect(addBtn).toBeEnabled({ timeout: 10000 });
  await addBtn.click({ timeout: 30000 });
  const row = page.locator('tr', { hasText: REG });
  await expect(row.first()).toBeVisible({ timeout: 30000 });
  await expect(row.first()).toContainText('Closed');
  console.log(`REGISTER CREATED: ${REG} (Closed)`);

  // ---- 2. Update (rename) via Manage ---------------------------------------
  await row.first().getByRole('button', { name: 'Manage' }).click();
  await expect(page.getByText('Update Cash Register')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(REG_U);
  await page.getByRole('button', { name: 'Save', exact: true }).click({ timeout: 30000 });
  const rowU = page.locator('tr', { hasText: REG_U });
  await expect(rowU.first()).toBeVisible({ timeout: 30000 });
  // Exact-cell match: REG_U contains REG as a substring.
  await expect(page.getByRole('cell', { name: REG, exact: true })).toHaveCount(0);
  console.log(`REGISTER RENAMED: ${REG} -> ${REG_U}`);

  // ---- 3. Open a session on OUR register -----------------------------------
  await h.openRegisterSession(page, REG_U);
  console.log(`REGISTER SESSION OPENED: ${REG_U}`);

  // ---- 4. Read back in All Logs --------------------------------------------
  await page.locator('tr', { hasText: REG_U }).first().getByRole('button', { name: 'All Logs' }).click();
  // Two headings match (modal + page); log rows load after the heading, so wait for today's date.
  await expect(page.getByText('Cash Register Logs').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(todayStr).first()).toBeVisible({ timeout: 30000 });
  const logsText = await page.locator('body').innerText();
  expect(logsText).toContain(todayStr);
  console.log(`REGISTER LOGS READ: session opened ${todayStr} present in All Logs`);
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForTimeout(1500);

  // ---- 5. Close the session -------------------------------------------------
  const { expectedCash } = await h.closeRegisterSession(page, REG_U);
  expect(expectedCash).toBe(0);
  console.log(`REGISTER SESSION CLOSED: ${REG_U} (closing cash Rp${expectedCash} = expected Rp0)`);

  // ---- 6. Delete? (probes found no Delete control) --------------------------
  const manageBtn = page.locator('tr', { hasText: REG_U }).first().getByRole('button', { name: 'Manage' });
  await manageBtn.click();
  await expect(page.getByText('Update Cash Register')).toBeVisible({ timeout: 30000 });
  const deleteBtn = page.getByRole('button', { name: /delete/i });
  if (await deleteBtn.count()) {
    console.log('REGISTER DELETE CONTROL FOUND — attempting delete');
    await deleteBtn.first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('tr', { hasText: REG_U }).first()).toHaveCount(0, { timeout: 30000 });
    console.log(`REGISTER DELETED: ${REG_U}`);
  } else {
    console.log(`NO DELETE CONTROL for cash registers (Manage form has Save/Close only) — ${REG_U} left standing (Closed, no session)`);
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  }

  // ---- 7. Guard: Default register still Open --------------------------------
  await page.goto(h.URLS.cashRegisters);
  await expect(page.locator('tr', { hasText: 'Default' }).first()).toContainText('Open', { timeout: 30000 });
  console.log('GUARD OK: Default register still Open');
});
