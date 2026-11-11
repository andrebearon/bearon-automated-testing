# Early status notes (1–6 Nov 2026)

Moved here from the old README during the 11 Nov 2026 restructure. Spec paths refer to the old `tests/*.spec.js` names; see README for the mapping.

## Status

Scaffold + first test written 1 Nov 2026. First full PASS 2 Nov 2026,
01:09 SGT, in 2.3 minutes through this VM's proxy (not ~1 minute —
each Bearon navigation takes 10–20s here; on a normal machine it
should be faster): product "Auto Test 52847007" (Rp10,000) created,
cash sale completed as order CEE-51004, found in Order Management,
and Order Details verified (product name, Paid, Cash, Rp10,000).
Cleanup note: no Void control was available for that order, so the
mock sale was left as-is in the demo workspace. Earlier runs also
completed sales CEE-51001, CEE-51002 (if created) and CEE-51003,
plus several products, all mock data in the demo "Cafe muse2"
workspace only — never the audit's "Muse cafe" workspace.

Environment limitation found 2 Nov 2026 ~00:03 SGT: Chromium launched
from this VM via exec cannot reach the internet at all
(net::ERR_TUNNEL_CONNECTION_FAILED, even for example.com, with proxy
flag, Playwright proxy option, and --no-proxy-server all tried), while
curl through the same proxy succeeds and Muse's leased browser works.
So the first live Playwright run cannot happen in this VM; run it on a
local machine (or another runner with normal internet), where
`npm run auth` / env-login + `npm test` apply as documented.

## Status — new specs (5 Nov 2026)

Full-suite run 1, 5 Nov 2026 ~18:19–18:27 SGT (7.9m via `./run-test.sh`):
1 passed, 2 failed. The original `product-to-order` spec PASSED
untouched. The two new specs failed on two distinct, now-fixed causes:

1. `product-crud` — test timeout (300s) while waiting for the add-on
   choice input. Root cause (helper bug, not the app): the add-on group
   does NOT pre-create a choice row ("Nothing to pick from yet"), so the
   first choice also needs an "Add choice" click. Fixed in
   `tests/helpers.js` (`fillProductAddOns` now clicks "Add choice" for
   every choice). The spec also got a 600s timeout for the slow VM proxy.
2. `sales-order-management` — OM list renders the payment method
   lowercase ("cash"), the assertion expected "Cash". Fixed with
   case-insensitive matches (`/cash/i`, `/card/i`, `/paid/i`). The cash
   sale itself worked (order CEE-51006, Rp15,000, Paid). The spec also
   got a 600s timeout.

Left behind in "Cafe muse2" by run 1 (all mock data, demo workspace
only): category "CRUD Cat 73962404" (created; its product was never
saved); product "Sales Prod 74340573" (created; its delete step never
ran because the spec failed before cleanup); order CEE-51006 (cash sale
Rp15,000, Paid — not voided, because the spec failed before the void
step); plus the original spec's product + order from its passing run.

NOT yet verified: the two fixes above have NOT been re-run — the
verification runs (two full-suite passes in a row) are still pending
and need a go-ahead to execute. Also note: when piping
`./run-test.sh` through `tail`, the shell reports tail's exit code,
not Playwright's — check the "N passed / M failed" lines, or run
without the pipe, to get the true result.

## Status — 14-scenario expansion (6 Nov 2026 evening)

Session refreshed with the new demo account (20:39 SGT); workspace
confirmed "Cafe muse2" (v0.3.633). Baseline re-run of the 3 existing
specs: 1 passed / 2 failed (12.7m) — both failures were TEST BUGS
(product-crud: options need the "Stock per combination" switch, not
a Generate button; sales-order-management: checkout renders async,
note + Take Away were silently skipped, refund read too early).
Both fixed and re-run green individually (product-crud 53.5s,
sales-order-management 1.7m). Full results + probe findings:
`SCENARIO-RESULTS-2026-11-06.md`.

- Scenario 1 (CRUD product) PASS, scenario 7 (POS sales / order /
  receipt) PASS, scenario 3 (CRUD supplier) PASS (1.0m, run 3;
  supplier "Test Supp 71990870", created → updated → deleted, no
  leftover). The supplier fix also hardened deletes: `deleteByKebab`
  now polls for the async Delete Confirmation dialog and waits for
  the row to vanish.
- Scenarios 4 (CRUD purchase order) and 5 (new supplier + new PO)
  are WRITTEN, probe-verified and syntax-checked — but NOT RUN: from
  ~21:33 SGT the VM stopped launching Chromium (dies with SIGTRAP /
  "browser has been closed" ~200ms after launch) and file writes
  intermittently returned EPERM. Node and plain file writes recovered,
  but Chromium still fails on retry (verified by the coordinator
  21:56 SGT). No spec-4/5 leftovers exist (neither spec ever ran).
- Scenarios 2, 6, 8, 9, 10, 11, 12, 13, 14: specs NOT yet written.
  Next step when the VM recovers (or on a normal machine):
  `./run-tests.sh tests/purchase-order.spec.js`, then
  `tests/supplier-purchase-order.spec.js`, then build the remaining
  scenarios, then the full suite (two consecutive passes still
  pending).

## Status — full-suite run 2 (6 Nov 2026, ~20:32–20:34 SGT)

0 passed / 3 failed, exit 1, ~1 min 50 s — BLOCKED on an expired
saved session, not an app bug and not a test bug. All three specs
failed at the first Home-heading assertion: `/console` redirected
to the login page ("Welcome Back"), because
`auth/.storage-state.json` (last written 5 Nov 18:13 SGT) was no
longer valid. No product, till or order behaviour was exercised,
and nothing new was left in "Cafe muse2". Unblocker: refresh the
session with `node auth/env-login.js` (second demo account, via
the local `.env`), then re-run the full suite. No re-login was
attempted in this run. User stories for the next tests are in
Notion, "Automated Testing — User Stories" (ID
410643b8-4afa-811b-908f-df9b45706810, under 1. Bearon Audit).

Probe findings (5 Nov 2026, v0.3.630, "Cafe muse2") that shaped the
specs: product delete exists ONLY in the products-list row kebab menu
(View / Delete) — no Delete button on the details page, which is itself
an edit form; the category page has no Delete control found (View only),
so category cleanup is best-effort; Card payment completes with just
"Confirm Order" (no card details needed); Update Status dialog offers
a Status field + Notes textarea; Void dialog needs a reason; Refund
dialog takes an amount + optional reason; the till blocks adding an
item with unpicked option groups (so the sales spec's product has no
options); checkout offers Dine In / Take Away order types (Take Away
attempted best-effort) and a notes field.

