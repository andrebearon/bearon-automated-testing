// Shared constants for every test case: the workspace guard, console routes
// and the shared fixtures that are reused across runs (never deleted).
// Routes were verified by probes against Bearon v0.3.63x; sidebar links are
// hidden in collapsed submenus, so tests always navigate by URL.

// Every test aborts unless the console is on this demo workspace.
const WORKSPACE = 'Cafe muse2';

// Shared reuse-or-create category for tests that do not test categories.
const AUTO_CATEGORY = 'Auto Category';

const URLS = {
  console: '/console',
  till: '/console/pos/dashboard/pos/sales/',
  orderManagement: '/console/pos/dashboard/pos/order-management/',
  cashRegisters: '/console/pos/dashboard/pos/cash-register/',
  categories: '/console/pos/dashboard/inventory/categories/',
  products: '/console/pos/dashboard/inventory/products/',
  suppliers: '/console/pos/dashboard/inventory/suppliers/',
  purchaseOrders: '/console/pos/dashboard/inventory/purchase-orders/',
  purchaseOrderCreate: '/console/pos/dashboard/inventory/purchase-orders/create/?purchaseOrderId=',
  manageStocks: '/console/pos/dashboard/inventory/manage-stocks/',
  customers: '/console/pos/dashboard/crm/customers/',
  posFeatures: '/console/settings/features/pos/',
  // Hard-coded screen for "Cafe muse2"; change if the kitchen screen is recreated.
  kitchenBoard: '/console/pos/dashboard/pos/kitchen-display/display/?locationId=54&screenId=6',
};

// Labels of switches in Settings > Features > POS.
const POS_FEATURES = {
  holdOrders: 'Let staff hold open orders',
  kitchenTickets: 'Show orders on a kitchen screen',
};

module.exports = { WORKSPACE, AUTO_CATEGORY, URLS, POS_FEATURES };
