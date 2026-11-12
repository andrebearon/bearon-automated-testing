// Cash register helpers: open the register on the till, read a register's
// status, and open / close a session on a specific register.
// UI facts (probe-verified, v0.3.639):
// - Open Register / Close Register at Rp0 do nothing until a keypad digit is
//   pressed first, so we always press "0" (or the amount) before clicking.
// - The Cash Registers page "Open session" button only navigates to the till;
//   it does NOT select that register. The till top bar has two
//   button[role=combobox]: Location, then Register. Pick the register in the
//   2nd one (their accessible names differ from the visible text, so use CSS).
// - The Close Cash Register panel renders in pieces; wait for both the
//   register name and Expected Cash before reading it.
// - Never trust toContainText('Open') on a row: the "Open session" button
//   always contains it. registerStatus() checks for "Closed" too.
const { expect } = require('@playwright/test');
const { sleep } = require('./common');
const { URLS } = require('./constants');

// Open the register if the till shows the Open Register dialog; tolerate an already-open register.
async function openRegisterIfNeeded(page) {
  const openRegister = page.getByRole('button', { name: 'Open Register' });
  let dialogPresent = false;
  try {
    await openRegister.first().waitFor({ state: 'visible', timeout: 30000 });
    dialogPresent = true;
  } catch {
    // No register dialog: register already open, proceed.
  }
  if (dialogPresent) {
    const keypadZero = page.getByRole('button', { name: '0', exact: true }).first();
    if (await keypadZero.count()) await keypadZero.click();
    await openRegister.first().click();
    await sleep(2000);
    // The first click can be swallowed; press a digit and click again.
    if (await openRegister.count()) {
      console.log('OPEN REGISTER button still present after click — retrying keypad + click');
      const zero2 = page.getByRole('button', { name: '0', exact: true }).first();
      if (await zero2.count()) await zero2.click();
      await openRegister.first().click();
    }
    await expect(openRegister).toHaveCount(0, { timeout: 30000 });
  }
}

async function registerStatus(page, name) {
  await page.goto(URLS.cashRegisters);
  // The table shows 15 rows per page, newest first — an older register
  // (e.g. Default) sits on page 2, so search for the name first.
  await searchCashRegister(page, name);
  const row = page.locator('tr', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const text = await row.innerText();
  return /Open/.test(text) && !/Closed/.test(text) ? 'Open' : 'Closed';
}

// Filter the Cash Registers table by name (15 rows/page, newest first).
async function searchCashRegister(page, name) {
  const search = page.getByPlaceholder('Search cash registers by name...');
  await expect(search).toBeVisible({ timeout: 30000 });
  await search.fill(name);
  await sleep(1500);
}

// Close a register session with closing cash = expected cash. Returns { expectedCash, panelText }.
async function closeRegisterSession(page, registerName) {
  await page.goto(URLS.cashRegisters);
  await searchCashRegister(page, registerName);
  const row = page.locator('tr', { hasText: registerName }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  // Fail fast if already closed, instead of waiting for the test timeout.
  if ((await row.getByRole('button', { name: 'Close session' }).count()) === 0) {
    throw new Error(`closeRegisterSession: ${registerName} has no "Close session" button (already Closed?)`);
  }
  await row.getByRole('button', { name: 'Close session' }).click({ timeout: 30000 });
  await expect(page.getByText('Close Cash Register')).toBeVisible({ timeout: 30000 });
  await page.waitForFunction((name) => {
    const t = document.body.innerText;
    return new RegExp(`Register:\\s*${name}`).test(t) && /Expected Cash\s*Rp[\d.,]+/.test(t);
  }, registerName, { timeout: 15000 });
  const panelText = await page.locator('body').innerText();
  // Guard: never close another register's session by mistake.
  expect(panelText).toContain(`Register:\n${registerName}`);
  const m = panelText.match(/Expected Cash\s*Rp([\d.,]+)/);
  if (!m) throw new Error(`Expected Cash not found on close panel for ${registerName}`);
  const expectedCash = Number(m[1].replace(/[.,]/g, ''));
  console.log(`CLOSE PANEL ${registerName}: Expected Cash Rp${expectedCash} :: ${(panelText.match(/Cash Sales\s*Rp[\d.,]+/) || ['?'])[0]} :: ${(panelText.match(/Total Takings\s*Rp[\d.,]+/) || ['?'])[0]}`);
  for (const d of String(expectedCash)) {
    await page.getByRole('button', { name: d, exact: true }).first().click();
    await sleep(200);
  }
  await page.getByRole('button', { name: 'Close Register' }).click({ timeout: 30000 });
  await sleep(3000);
  await page.goto(URLS.cashRegisters);
  await expect(page.locator('tr', { hasText: registerName }).first()).toContainText('Closed', { timeout: 30000 });
  console.log(`REGISTER SESSION CLOSED: ${registerName} (closing cash Rp${expectedCash} = expected)`);
  return { expectedCash, panelText };
}

// FIX (11 Nov 2026, gated chain 9-14, 10 Nov evening): the till register
// pick failed 3x in a row; the 3rd time the retry click on the 2nd
// combobox was blocked ~4 min by an open backdrop overlay
// (<div data-state="open" class="fixed inset-0 z-50 ... bg-black/90">,
// 408 retries) and ended "locator.click: Target crashed". Playwright
// retries a blocked click until its timeout, so a bare click here can
// burn minutes. Before every combobox click, check for that overlay:
// wait briefly for it to settle, press Escape once, and if it is still
// there fail fast with a clear diagnostic instead of retrying the click.
// What dialog/backdrop is open at that point is still unknown — if this
// throws, that is the probe to run next, not a reason to remove the guard.
async function clearBlockingOverlay(page, label) {
  const overlay = page.locator('div[data-state="open"].fixed.inset-0.z-50').first();
  try {
    await overlay.waitFor({ state: 'visible', timeout: 3000 });
  } catch { return; } // No overlay — proceed.
  console.log(`BLOCKING OVERLAY present before ${label} — pressing Escape once`);
  await page.keyboard.press('Escape');
  await sleep(1500);
  try {
    await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    console.log('BLOCKING OVERLAY cleared');
  } catch {
    throw new Error(`Blocking overlay still open before ${label} — not retrying the click (see 10 Nov gated-chain failure)`);
  }
}

// Select a register in the till's Register combobox and open a session on it.
async function openRegisterSession(page, registerName = 'Default') {
  if ((await registerStatus(page, registerName)) === 'Open') {
    console.log(`REGISTER SESSION ALREADY OPEN: ${registerName}`);
    return;
  }
  await page.goto(URLS.till);
  await page.waitForTimeout(3000);
  const combos = page.locator('button[role="combobox"]');
  await expect(combos.nth(1)).toBeVisible({ timeout: 30000 });
  const current = (await combos.nth(1).innerText()).trim();
  if (current !== registerName) {
    // The option click can land without the selection taking; verify and retry once.
    // NOTE (11 Nov 2026): the till selector shows the register as
    // "<name> (Counter)" — the pick HAS applied when the name matches
    // before the trailing parenthetical, so strip that suffix before
    // comparing instead of failing on the display text.
    const shownName = (s) => s.replace(/\s*\([^)]*\)\s*$/, '');
    for (let attempt = 0; attempt < 2; attempt++) {
      await clearBlockingOverlay(page, 'till register pick');
      await combos.nth(1).click({ timeout: 10000 });
      await sleep(1500);
      const opt = page.getByRole('option', { name: registerName }).first();
      await expect(opt).toBeVisible({ timeout: 15000 });
      await opt.click({ timeout: 15000 });
      await sleep(2000);
      const shown = (await combos.nth(1).innerText()).trim();
      if (shownName(shown) === registerName) {
        console.log(`TILL REGISTER SELECTED: ${registerName} (shown as "${shown}")`);
        break;
      }
      console.log(`TILL REGISTER PICK NOT APPLIED (shows "${shown}"), retrying`);
      if (attempt === 1) throw new Error(`Till register selector still shows "${shown}", expected ${registerName}`);
    }
  }
  // The open itself can silently fail (race); retry pick + open once.
  for (let openAttempt = 0; openAttempt < 2; openAttempt++) {
    await openRegisterIfNeeded(page);
    const status = await registerStatus(page, registerName);
    if (status === 'Open') {
      console.log(`REGISTER SESSION OPEN: ${registerName}`);
      return;
    }
    console.log(`OPEN ATTEMPT ${openAttempt} did not open ${registerName} — retrying pick + open`);
    await page.goto(URLS.till);
    await sleep(2000);
    const combos2 = page.locator('button[role="combobox"]');
    await expect(combos2.nth(1)).toBeVisible({ timeout: 30000 });
    await clearBlockingOverlay(page, 'till register re-pick');
    await combos2.nth(1).click({ timeout: 10000 });
    await sleep(1500);
    await page.getByRole('option', { name: registerName }).first().click({ timeout: 15000 });
    await sleep(2000);
  }
  throw new Error(`Register ${registerName} still Closed after 2 open attempts`);
}

module.exports = { openRegisterIfNeeded, registerStatus, closeRegisterSession, openRegisterSession, searchCashRegister, clearBlockingOverlay };
