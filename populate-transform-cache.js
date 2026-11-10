// Pre-populate Playwright's transform cache so the test runner can load
// files WITHOUT writing (the VM's write() to regular files currently
// fails intermittently with EPERM from node processes, which breaks the
// runner at the first transform). Entries use the ORIGINAL file content
// as the cached code (all files here are plain CommonJS, so the original
// source is valid module code); readCodeCache only validates that the
// sha1 header matches the body. Paths/hashes replicate
// node_modules/playwright/lib/common/index.js exactly:
//   filePathHash = sha1(absPath)[0:10]
//   contentHash  = sha1("no_esm" + content + absPath + "1.64.1")
//   cachePath    = <cacheDir>/<hash[0:2]>/<hash>_<contentHash[0:7]>_<basename-no-ext-no-nonword>.js
//   file content = "// <sha1(content)>\n" + content
// Run: node populate-transform-cache.js [spec...]  (defaults to all specs)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '1.64.1';
const ROOT = __dirname;
const CACHE_DIR = '/tmp/playwright-transform-cache-0';
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

const files = process.argv.length > 2 ? process.argv.slice(2) : [
  'playwright.config.js',
  'tests/helpers.js',
  'tests/product-crud.spec.js',
  'tests/product-to-order.spec.js',
  'tests/sales-order-management.spec.js',
  'tests/supplier-crud.spec.js',
  'tests/purchase-order.spec.js',
  'tests/supplier-purchase-order.spec.js',
];

let done = 0, failed = 0;
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
  const code = `// ${sha1(content)}\n${content}`;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, code, 'utf8');
    console.log(`CACHED: ${rel} -> ${cachePath}`);
    done++;
  } catch (e) {
    console.log(`FAILED: ${rel}: ${e.code || e.message}`);
    failed++;
  }
}
console.log(`populate-transform-cache: ${done} written, ${failed} failed`);
process.exit(failed ? 1 : 0);
