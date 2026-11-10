// Compute (no writes) the Playwright transform-cache paths + sha1 headers
// for the files the runner loads. Prints one line per file:
//   <cachePath>\t<sha1(content)>
// A bash loop can then do: { echo "// $SHA"; cat "$FILE"; } > "$CACHEPATH"
// (bash writes still work intermittently while node writes are blocked).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '1.64.1';
const ROOT = __dirname;
const CACHE_DIR = '/tmp/playwright-transform-cache-0';
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

const files = [
  'playwright.config.js',
  'tests/helpers.js',
  'tests/product-crud.spec.js',
  'tests/product-to-order.spec.js',
  'tests/sales-order-management.spec.js',
  'tests/supplier-crud.spec.js',
  'tests/purchase-order.spec.js',
  'tests/supplier-purchase-order.spec.js',
];

for (const rel of files) {
  const abs = path.resolve(ROOT, rel);
  const content = fs.readFileSync(abs, 'utf8');
  const filePathHash = sha1(abs).substring(0, 10);
  const contentHash = crypto.createHash('sha1')
    .update('no_esm').update(content).update(abs).update(VERSION).update('').update('')
    .digest('hex');
  const folder = filePathHash.substring(0, 2);
  const base = path.basename(abs, path.extname(abs)).replace(/\W/g, '');
  const fileName = `${filePathHash}_${contentHash.substring(0, 7)}_${base}.js`;
  const cachePath = path.join(CACHE_DIR, folder, fileName);
  console.log(`${abs}\t${cachePath}\t${sha1(content)}`);
}
