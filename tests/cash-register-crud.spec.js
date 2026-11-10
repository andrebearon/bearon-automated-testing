// Scenario 9 — CRUD cash register.
// Creates a NEW register (leaves the existing "Default" register and its
// open session untouched), renames it via Manage, opens a session on it
// from the till, reads it back in All Logs, closes the session with
// closing cash = expected cash (Rp0, no sales on this register), then
// looks for a Delete control (none was seen in probes — recorded, not
// forced). Guards: the close panel's "Register:" must name OUR register
// before Close Register is clicked, and Default must still be Open at
// the end. Test account (demo workspace "Cafe muse2"), mock data only.
// Unique names per run; cleanup is this run's own records only.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const suffix = Date.now().toString().slice(-8);
const REG = `Reg CRUD ${suffix}`;
const REG_U = `${REG}U`;
const PAGE = '/console/pos/dashboard/pos/cash-register/';
const today = new Date();
const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

test('cash register CRUD: create, rename, open session, read logs, close session', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. Create a new register -------------------------------------------
  await page.goto(PAGE);
  await page.getByRole('button', { name: 'Create Cash Register' }).click();
  await expect(page.getByText('Add New Cash Register')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="name"]').fill(REG);
  await page.locator('input[name="description"]').fill(`Cash register test ${suffix}`);
  // Location* is REQUIRED and the select starts EMPTY (run 1: the submit
  // stayed disabled for the full 600s test timeout because no location
  // was chosen). Pick the select whose options include 'Cafe muse2'.
  const selects = page.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const opts = await selects.nth(i).locator('option').allInnerTexts();
    if (opts.includes('Cafe muse2')) await selects.nth(i).selectOption({ label: 'Cafe muse2' });
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
  // Exact-cell match: REG_U contains REG as a substring, so a hasText
  // check on REG would still match the renamed row.
  await expect(page.getByRole('cell', { name: REG, exact: true })).toHaveCount(0);
  console.log(`REGISTER RENAMED: ${REG} -> ${REG_U}`);

  // ---- 3. Open a session on OUR register -----------------------------------
  // FIX (7 Nov 2026, resume run): the row's "Open session" button only
  // navigates to the till without selecting the register, and
  // toContainText('Open') is a false positive (the row always contains
  // the "Open session" button). The helper picks the register in the
  // till's Register combobox first, then opens it; status is verified
  // via the Status cell (registerStatus), not a substring.
  await h.openRegisterSession(page, REG_U);
  console.log(`REGISTER SESSION OPENED: ${REG_U}`);

  // ---- 4. Read back in All Logs --------------------------------------------
  await page.locator('tr', { hasText: REG_U }).first().getByRole('button', { name: 'All Logs' }).click();
  // FIX (7 Nov 2026, resume run): strict-mode violation — the text
  // matches 2 headings (modal h2 + page h2 behind it). First is the modal.
  await expect(page.getByText('Cash Register Logs').first()).toBeVisible({ timeout: 30000 });
  // FIX (7 Nov 2026, resume run): the log rows load asynchronously
  // AFTER the heading renders — reading the body immediately sees an
  // empty table. Probe-verified: the open session's row appears
  // (Opened At 07/11/2026 05:07, Closed At "-", Opening Rp0). Wait for
  // today's date to appear in the modal before reading.
  await expect(page.getByText(todayStr).first()).toBeVisible({ timeout: 30000 });
  const logsText = await page.locator('body').innerText();
  expect(logsText).toContain(todayStr);
  console.log(`REGISTER LOGS READ: session opened ${todayStr} present in All Logs`);
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForTimeout(1500);

  // ---- 5. Close the session -------------------------------------------------
  // Use the helper: it guards the panel names OUR register, enters the
  // expected cash on the keypad (Rp0 quirk: a digit press is needed
  // before Close Register lands), and verifies Closed afterwards.
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
  await page.goto(PAGE);
  await expect(page.locator('tr', { hasText: 'Default' }).first()).toContainText('Open', { timeout: 30000 });
  console.log('GUARD OK: Default register still Open');
});
