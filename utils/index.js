// Single entry point for test cases: `const h = require('../utils');`
// Each module groups helpers for one area of the Bearon console.
module.exports = {
  ...require('./constants'),
  ...require('./common'),
  ...require('./workspace'),
  ...require('./cash-register'),
  ...require('./product'),
  ...require('./stock'),
  ...require('./till'),
  ...require('./order-management'),
  ...require('./supplier'),
  ...require('./purchase-order'),
  ...require('./kitchen'),
};
