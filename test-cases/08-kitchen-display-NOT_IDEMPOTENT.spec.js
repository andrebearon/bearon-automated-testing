/**
 * Scenario 08 — Kitchen display order lifecycle
 *
 * Flow:
 *   1. Turn kitchen tickets ON (Settings > Features > POS), remembering the old state.
 *   2. Create own product, cash sale at the till.
 *   3. Verify the order appears on the kitchen board in "Not started" (1 x product).
 *   4. Progress it: Start Preparing -> Mark Ready -> Mark Completed,
 *      verifying each move.
 *   5. Restore kitchen tickets to the previous state (always, via finally).
 *
 * Data:    "Kitchen Prod <suffix>" and its order.
 * Cleanup: order voided + product deleted, both best-effort.
 * Notes:   The board refreshes on a ~60s poll, so this is the slowest test (15 min budget).
 */
const { test, expect } = require('@playwright/test');
const h = require('../utils');

const suffix = h.runSuffix();
const PRODUCT = `Kitchen Prod ${suffix}`;
const PRICE = 15000;

test('kitchen display: order appears, progresses to completed', async ({ page }) => {
  test.setTimeout(900 * 1000);
  await h.ensureWorkspace(page);
  let ticketsWereOn = false;
  let orderRef = null;

  try {
    // ---- 1. Turn kitchen tickets ON (remember the previous state) --------
    ticketsWereOn = await h.setPosFeature(page, h.POS_FEATURES.kitchenTickets, true);

    // ---- 2. Own product + cash sale ---------------------------------------
    await h.ensureCategory(page, h.AUTO_CATEGORY);
    await h.createSimpleProduct(page, {
      name: PRODUCT, category: h.AUTO_CATEGORY, price: PRICE,
      description: `Kitchen test product ${suffix}`,
    });
    await h.openRegisterIfNeeded(page);
    const sale = await h.completeTillSale(page, { product: PRODUCT, qty: 1, price: PRICE, payment: 'Cash' });
    orderRef = sale.ref;
    console.log(`SALE FOR KITCHEN: ${orderRef} (${PRODUCT} x1 @ Rp${PRICE}, Cash)`);

    // ---- 3. Order appears on the board in Not started ----------------------
    await h.openKitchenBoard(page);
    await h.waitForOrderOnBoard(page, orderRef);
    const boardText = await page.locator('body').innerText();
    expect(boardText).toContain(PRODUCT);
    expect(boardText).toMatch(/1 x/); // board renders "1 x <product>", not "1x"
    console.log(`BOARD VERIFIED: ${orderRef} in Not started (${PRODUCT} 1x)`);

    // ---- 4. Progress through the board --------------------------------------
    await h.progressKitchenOrder(page, orderRef, 'Start Preparing', 'Mark Ready');
    console.log(`BOARD PROGRESS: ${orderRef} -> In Progress`);
    await h.progressKitchenOrder(page, orderRef, 'Mark Ready', 'Mark Completed');
    console.log(`BOARD PROGRESS: ${orderRef} -> Ready to Serve`);
    await h.progressKitchenOrder(page, orderRef, 'Mark Completed', null);
    console.log(`BOARD PROGRESS: ${orderRef} -> Completed Orders`);
  } finally {
    // ---- 5. Restore kitchen tickets to their previous state -----------------
    await h.bestEffort('restore kitchen tickets setting', async () => {
      await h.setPosFeature(page, h.POS_FEATURES.kitchenTickets, ticketsWereOn);
    });
  }

  // ---- 6. Best-effort cleanup: void own order + delete own product ---------
  if (orderRef) {
    await h.bestEffort(`void order ${orderRef}`, async () => {
      await h.openOrderDetails(page, orderRef);
      const voidBtn = page.getByRole('button', { name: /void order/i }).first();
      if (await voidBtn.count()) {
        await voidBtn.click();
        await page.locator('textarea').last().fill(`Kitchen test void ${suffix}`);
        await page.getByRole('button', { name: 'Void order', exact: true }).last().click();
      }
    });
  }
  await h.bestEffort(`delete product ${PRODUCT}`, async () => {
    await h.deleteProductByKebab(page, PRODUCT);
  });
});
