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
- **No credentials in the repo.** Demo credentials live only in `.env`
  (gitignored, chmod 600; template in `.env.example`). The login session is
  saved to `auth/.storage-state.json` (gitignored). Never print or commit either.
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
test-cases/            One file per scenario: NN-<area>-<what>[-NOT_IDEMPOTENT].spec.js
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
  global-setup.js      Runs before every test run: logs in from .env if the session is missing/expired
  env-login.js         Headless login with .env credentials, saves the session
  setup.js             Manual login in a headed browser (no .env needed)
.env.example           Template for .env (credentials, optional base URL)
scripts/vm/            Only for the sandbox VM whose egress proxy breaks Chromium
  local-proxy.js       Local CONNECT proxy that forwards to the egress proxy
  run-tests.sh         Starts the proxy, runs Playwright, prints PLAYWRIGHT_EXIT
docs/results/          Dated run logs: results, failures, leftovers, app-bug candidates
playwright.config.js   Loads .env, testDir ./test-cases, 1 worker, 300s default timeout
```

Each util module starts with a header comment listing the probe-verified UI
facts it relies on (async dialogs, hidden duplicates, required fields). Read it
before changing a helper.

## Test cases

**Idempotency is in the filename.** A test is idempotent by default: it deletes
everything it creates and can run any number of times without leaving data.
A test that leaves data behind ends in `-NOT_IDEMPOTENT.spec.js`, usually
because the app cannot delete the record (sales orders, cash registers).
Run `npm run test:idempotent` to skip those.

| # | File | What it covers | Leaves behind |
|---|---|---|---|
| 01 | `01-product-crud-NOT_IDEMPOTENT.spec.js` | Product with new category, options, add-ons: create, verify, update, delete | 1 category (no delete control on its details page) |
| 02 | `02-category-crud.spec.js` | Category create, rename, delete | nothing |
| 03 | `03-supplier-crud.spec.js` | Supplier create, verify, update, delete | nothing |
| 04 | `04-purchase-order-crud.spec.js` | PO create, verify, update qty, receive, delete | nothing |
| 05 | `05-supplier-purchase-order-flow.spec.js` | New supplier + PO, receive, stock goes "-" to 5 | nothing |
| 06 | `06-stock-adjustment.spec.js` | Stock adjustments +10 then -3, list matches editor | nothing |
| 07a | `07a-sales-order-management-NOT_IDEMPOTENT.spec.js` | Cash + card sales, OM details, note, void, refund | 2 orders (voided, refunded) |
| 07b | `07b-product-to-order-NOT_IDEMPOTENT.spec.js` | Smoke: product, cash sale, order in OM, details | 1 product + 1 Paid order |
| 08 | `08-kitchen-display-NOT_IDEMPOTENT.spec.js` | Kitchen board: order appears, Not started to Completed | 1 voided order |
| 09 | `09-cash-register-crud-NOT_IDEMPOTENT.spec.js` | New register: create, rename, open, logs, close | 1 Closed register (no delete in UI) |
| 10 | `10-cash-register-order-mix-NOT_IDEMPOTENT.spec.js` | New register: void 1, refund 1, cancel pending 1, close = Rp10,000 | 1 Closed register, 3 orders, 1 cancelled pending order |
| 11 | `11-pending-order-crud-NOT_IDEMPOTENT.spec.js` | Pending order on Slot 2: create, qty update, delete | the pending order, if no delete control is found |
| 12 | `12-pending-order-flow-NOT_IDEMPOTENT.spec.js` | Pending on Slot 1, move to Slot 2, checkout, Paid in OM | 1 Paid order |
| 13 | `13-customer-crud.spec.js` | Customer create, update phone, delete | nothing |
| 14 | — not written yet — | POS sale with a customer, history in customer details | |

Latest status (10 Nov 2026): 01–08 pass. 09 is flaky at the till register pick
(an overlay blocks the retry), which stops 10–13 when run as a gated chain. See
`docs/results/` for the full history.

## Running

### 1. One-time setup

Needs Node.js 20.12+ (for built-in `.env` loading).

```bash
npm install
npx playwright install chromium
cp .env.example .env
chmod 600 .env
```

Then edit `.env` with the **demo** account (workspace "Cafe muse2"):

```dotenv
BEARON_TEST_EMAIL=<demo account email>
BEARON_TEST_PASSWORD=<demo account password>
# BEARON_BASE_URL=https://bearon.studio   # optional
```

`.env` is gitignored. Variables already set in your shell take priority over `.env`.

### 2. Run tests

```bash
npm test                                   # whole suite, in file order
npm run test:idempotent                    # only tests that leave no data behind
npx playwright test test-cases/03-supplier-crud.spec.js   # one test case
npx playwright test 03 05                  # several, by filename match
npx playwright test -g "supplier"          # by test title
npm run test:headed                        # watch the browser
npm run test:list                          # list tests without running
npm run report                             # open the last HTML report
```

### How login works

You don't need to log in by hand. Before every run, `auth/global-setup.js`:

1. opens `/console` with the saved session in `auth/.storage-state.json`;
2. if the file is missing or the session has expired (redirect to the login
   page), logs in headlessly with the `.env` credentials and saves a fresh session;
3. stops the run with a clear error if a login is needed and `.env` has no credentials.

Manual alternatives if you need them:

```bash
npm run env-login   # headless login with .env credentials
npm run auth        # log in by hand in a headed browser (no .env needed)
```

If login fails, check `/tmp/bearon-login-failure.png`.

### Sandbox VM only

There, Chromium cannot use the egress proxy directly, so run through the local proxy:

```bash
./scripts/vm/run-tests.sh test-cases/03-supplier-crud.spec.js
```

Read the result from the `N passed / M failed` lines or `PLAYWRIGHT_EXIT=`.
Piping into `tail` hides Playwright's exit code.

### Runbook for an agent

1. Check that `.env` exists with both credentials (do not print the values).
   If it is missing, stop and ask the user to create it from `.env.example`.
2. Start with a fast idempotent test (`02-category-crud`) to confirm login works.
3. Run test cases one at a time in number order. Ask before running
   `-NOT_IDEMPOTENT` tests if the user only asked for a clean check. 09–12
   change register and pending-order state, so stop and report if one fails.
4. For each run, note pass/fail, duration, order refs and leftovers from the
   console log lines (`PRODUCT CREATED`, `SALE COMPLETED`, `CLEANUP SKIPPED`…).
5. Write a dated log to `docs/results/YYYY-MM-DD-<topic>.md`. Do not edit old logs.
6. A failure is a **test bug** until proven otherwise. Check the trace
   (`npx playwright show-trace test-results/<dir>/trace.zip`) before calling it an app bug.

## Adding a test case

1. Pick the next number and a name: `test-cases/NN-<area>-<what>.spec.js`
   (`-crud` for create/read/update/delete of one entity, `-flow` for a multi-step journey).
   If the test leaves any data behind after a passing run, name it
   `NN-<area>-<what>-NOT_IDEMPOTENT.spec.js` and say what is left in `Cleanup:`.
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
