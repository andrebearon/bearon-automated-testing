# Bearon core-flow e2e tests (Playwright)

Deterministic pass/fail tests for Bearon console flows whose UX is stable.
No AI and no screenshots in the loop: tests assert on DOM text and values and
exit non-zero on failure. Trace and screenshot are kept only on failure.

> **For LLM agents:** read [Rules](#rules-non-negotiable) and [Running](#running)
> before running anything. To add a test, follow [Adding a test case](#adding-a-test-case).
> Every test case file starts with a header comment that describes its flow,
> the data it creates and its cleanup. Read the header first.

## Rules (non-negotiable)

- **Demo workspace only: "Cafe muse2".** Never the audit workspace "Muse cafe",
  never a real business, customer, payment or message. Every test calls
  `h.ensureWorkspace(page)` first, which aborts unless the console shows "Cafe muse2".
- **No credentials in the repo.** Auth is a saved session file
  (`auth/.storage-state.json`, gitignored). Demo credentials live only in `.env`
  (gitignored, chmod 600). Never print or commit them.
- **Unique data per run.** Every record a test creates is named `<Prefix> <suffix>`
  with `h.runSuffix()` (8 digits from the timestamp), so runs never collide.
  Never assert on list totals or first-row contents.
- **Cleanup touches only this run's records**, only after assertions pass, and
  is wrapped in `h.bestEffort()` so it can never fail a test.
- **One worker, one run at a time.** All tests share one workspace. Do not run
  in parallel with another suite or an audit on the same workspace (register
  totals and sales reports would pollute each other).
- **Never close or modify the "Default" cash register.** Tests that need a
  register session create their own.

## Project structure

```
test-cases/            One file per scenario: NN-<area>-<what>.spec.js
utils/                 Shared helpers, one module per console area
  index.js             Re-exports everything: const h = require('../utils')
  constants.js         WORKSPACE, AUTO_CATEGORY, URLS, POS_FEATURES
  common.js            sleep, runSuffix, todayDdMmYyyy, bestEffort, deleteByKebab
  workspace.js         ensureWorkspace, setPosFeature
  cash-register.js     openRegisterIfNeeded, registerStatus, open/closeRegisterSession
  product.js           ensureCategory, product form fills, find/open/create/delete, current stock
  stock.js             createStockAdjustment
  till.js              completeTillSale, savePendingOnSlot, openPendingList
  order-management.js  findOrderInOM, openOrderDetails
  supplier.js          createSupplier, findSupplierInList, openSupplierDetails
  purchase-order.js    createPurchaseOrder, open/update/receive purchase order
  kitchen.js           openKitchenBoard, waitForOrderOnBoard, progressKitchenOrder
auth/
  setup.js             Manual login in a headed browser, saves the session
  env-login.js         Headless login from env vars, saves the session
scripts/vm/            Only for the sandbox VM whose egress proxy breaks Chromium
  local-proxy.js       Local CONNECT proxy that forwards to the egress proxy
  run-tests.sh         Starts the proxy, runs Playwright, prints PLAYWRIGHT_EXIT
docs/results/          Dated run logs: results, failures, leftovers, app-bug candidates
playwright.config.js   testDir ./test-cases, 1 worker, 300s default timeout
```

Each util module starts with a header comment listing the probe-verified UI
facts it relies on (async dialogs, hidden duplicates, required fields). Read it
before changing a helper.

## Test cases

| # | File | What it covers | Creates (leftover?) |
|---|---|---|---|
| 01 | `01-product-crud.spec.js` | Product with new category, options, add-ons: create, verify, update, delete | Product (deleted), category (best-effort) |
| 02 | `02-category-crud.spec.js` | Category create, rename, delete | Category (deleted) |
| 03 | `03-supplier-crud.spec.js` | Supplier create, verify, update, delete | Supplier (deleted) |
| 04 | `04-purchase-order-crud.spec.js` | PO create, verify, update qty, receive, delete | PO, supplier, product (deleted) |
| 05 | `05-supplier-purchase-order-flow.spec.js` | New supplier + PO, receive, stock goes "-" to 5 | PO, supplier, product (deleted) |
| 06 | `06-stock-adjustment.spec.js` | Stock adjustments +10 then -3, list matches editor | Product (deleted) |
| 07a | `07a-sales-order-management.spec.js` | Cash + card sales, OM details, note, void, refund | Product (best-effort), 2 orders (voided / refunded) |
| 07b | `07b-product-to-order.spec.js` | Smoke: product, cash sale, order in OM, details | Product + 1 Paid order (left) |
| 08 | `08-kitchen-display.spec.js` | Kitchen board: order appears, Not started to Completed | Product (deleted), order (voided) |
| 09 | `09-cash-register-crud.spec.js` | New register: create, rename, open, logs, close | 1 Closed register (no Delete in UI) |
| 10 | `10-cash-register-order-mix.spec.js` | New register: void 1, refund 1, cancel pending 1, close = Rp10,000 | 1 Closed register, product (best-effort) |
| 11 | `11-pending-order-crud.spec.js` | Pending order on Slot 2: create, qty update, delete | Product (best-effort) |
| 12 | `12-pending-order-flow.spec.js` | Pending on Slot 1, move to Slot 2, checkout, Paid in OM | Product (best-effort), 1 Paid order |
| 13 | `13-customer-crud.spec.js` | Customer create, update phone, delete | Customer (deleted) |
| 14 | — not written yet — | POS sale with a customer, history in customer details | |

Latest status (10 Nov 2026): 01–08 pass. 09 is flaky at the till register pick
(an overlay blocks the retry), which stops 10–13 when run as a gated chain. See
`docs/results/` for the full history.

## Running

Prerequisites (once per machine):

```bash
npm install
npx playwright install chromium
```

Create the login session. Either log in by hand in a headed browser:

```bash
npm run auth
```

or log in headlessly with the demo credentials from `.env`:

```bash
set -a; . ./.env; set +a; npm run env-login; unset BEARON_TEST_EMAIL BEARON_TEST_PASSWORD
```

The session expires after a few days. Symptom: every test fails at
`ensureWorkspace` because `/console` shows the "Welcome Back" login page.
Fix: re-run the login step, then re-run the tests.

Run tests:

```bash
npm test                                             # whole suite, in file order
npx playwright test test-cases/03-supplier-crud.spec.js   # one test case
npx playwright test -g "supplier"                    # by test title
npm run test:list                                    # list tests without running
npm run report                                       # open the last HTML report
```

In the sandbox VM only (Chromium cannot use the egress proxy directly):

```bash
./scripts/vm/run-tests.sh test-cases/03-supplier-crud.spec.js
```

Read the result from the `N passed / M failed` lines or `PLAYWRIGHT_EXIT=`.
Piping into `tail` hides Playwright's exit code.

### Runbook for an agent

1. Check the session: run one fast test (`02-category-crud`). If it fails at
   `ensureWorkspace` with the login page, refresh the session (see above).
2. Run test cases one at a time in number order. 09–12 change register and
   pending-order state, so stop and report if one fails instead of continuing.
3. For each run, note pass/fail, duration, order refs and leftovers from the
   console log lines (`PRODUCT CREATED`, `SALE COMPLETED`, `CLEANUP SKIPPED`…).
4. Write a dated log to `docs/results/YYYY-MM-DD-<topic>.md`. Do not edit old logs.
5. A failure is a **test bug** until proven otherwise. Check the trace
   (`npx playwright show-trace test-results/<dir>/trace.zip`) before calling it an app bug.

## Adding a test case

1. Pick the next number and a name: `test-cases/NN-<area>-<what>.spec.js`
   (`-crud` for create/read/update/delete of one entity, `-flow` for a multi-step journey).
2. Start from this template:

```js
/**
 * Scenario NN — <short title>
 *
 * Flow:
 *   1. <step>
 *   2. <step>
 *
 * Data:    "<Prefix> <suffix>" (every record the test creates).
 * Cleanup: <what is deleted, what is best-effort, what is left behind>.
 * Needs:   <preconditions: feature switches, free slots…> (optional)
 * Notes:   <UI quirks this test depends on> (optional)
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `<Prefix> Prod ${suffix}`;

test('<area>: <what it proves>', async ({ page }) => {
  test.setTimeout(600 * 1000);
  await h.ensureWorkspace(page);

  // ---- 1. <step> ---------------------------------------------------------
  await h.ensureCategory(page, h.AUTO_CATEGORY);
  await h.createSimpleProduct(page, { name: PRODUCT, category: h.AUTO_CATEGORY, price: 10000 });

  // ---- 2. <step> ---------------------------------------------------------
  // ...assertions with expect()...

  // ---- N. Cleanup (only this run's records) ------------------------------
  await h.bestEffort(`delete product ${PRODUCT}`, () => h.deleteProductByKebab(page, PRODUCT));
});
```

3. Add a row to the [Test cases](#test-cases) table.
4. Helpers: keep logic used by one test inside that test file, readable top to
   bottom. Move it to `utils/<area>.js` only when 3+ test cases need it, and
   export it from `utils/index.js`. Add new routes to `URLS` in `utils/constants.js`.
5. Comments: the file header can be long; inline comments stay at 1–2 lines and
   say *why* (the UI quirk), not *what*.

## Conventions (from Playwright best practices)

Applied in this suite:

- **User-facing locators first**: `getByRole`, `getByText`, `getByPlaceholder`.
  CSS / `name=` attributes only where Bearon has no labels (product and supplier forms).
- **Web-first assertions**: `await expect(locator).toBeVisible()` / `toHaveValue()`
  retry until the timeout. Never use a non-waiting `count()` check to decide
  whether to act on something that renders async; it silently skips the step
  (this caused most early failures).
- **Isolated, idempotent tests**: unique names per run, reuse-or-create for
  shared fixtures (`Auto Category`), no dependency on another test's leftovers.
- **Verify after reload**: persistence is asserted on a fresh page load, not on a toast.
- **Saved auth state** via `storageState`, so tests never type passwords.
- **Traces on failure only** (`trace: 'retain-on-failure'`).

Known gaps, worth doing next:

- Replace fixed `sleep()` waits with waits on a specific UI state.
- Wrap each `// ---- N.` section in `test.step()` for readable HTML reports.
- Move login into a Playwright `setup` project so an expired session fails once, clearly.
- Tag tests (`@crud`, `@flow`, `@slow`) to run subsets with `--grep`.

## Results history

Dated run logs live in `docs/results/`:

- `2026-11-01-early-status.md`: first runs, VM limitations, first fixes.
- `2026-11-06-scenario-results.md`: 14-scenario build-out, probe findings,
  re-runs up to 10 Nov 2026, app-bug candidates and leftovers.
