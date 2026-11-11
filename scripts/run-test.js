// Run test cases by number or by name, without typing the full file path.
//   npm run test:one -- 3              -> test-cases/03-supplier-crud.spec.js
//   npm run test:one -- 7a             -> test-cases/07a-sales-order-management-NOT_IDEMPOTENT.spec.js
//   npm run test:one -- supplier-crud  -> any file whose name contains it (case-insensitive)
//   npm run test:one -- 2 3 13         -> several test cases (Playwright runs them in file order)
//   npm run test:one -- 3 --headed     -> anything starting with "-" goes to Playwright
// Each selector must match exactly one file; add --all to run every match of an
// ambiguous selector (e.g. "7" matches 07a and 07b, "crud" matches many).
// Set VM=1 to run through the sandbox VM proxy (scripts/vm/run-tests.sh).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'test-cases');

function main() {
  const args = process.argv.slice(2);
  const runAllMatches = args.includes('--all');
  const selectors = args.filter((a) => !a.startsWith('-'));
  const playwrightArgs = args.filter((a) => a.startsWith('-') && a !== '--all');
  const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.spec.js')).sort();

  if (selectors.length === 0) {
    console.log('Usage: npm run test:one -- <number|name> [...more] [--all] [playwright flags]\n');
    console.log('Test cases:');
    files.forEach((f) => console.log(`  ${f}`));
    process.exit(1);
  }

  const picked = [];
  for (const selector of selectors) {
    // "3" / "03" / "7a" match the number prefix; anything else matches the name.
    const numberMatch = selector.match(/^0*(\d+)([a-z]?)$/i);
    const matches = numberMatch
      ? files.filter((f) => f.toLowerCase().startsWith(`${numberMatch[1].padStart(2, '0')}${numberMatch[2].toLowerCase()}`))
      : files.filter((f) => f.toLowerCase().includes(selector.toLowerCase()));

    if (matches.length === 0) {
      console.error(`No test case matches "${selector}". Available:\n${files.map((f) => `  ${f}`).join('\n')}`);
      process.exit(1);
    }
    if (matches.length > 1 && !runAllMatches) {
      console.error(`"${selector}" matches ${matches.length} test cases. Be more specific, or add --all:\n${matches.map((f) => `  ${f}`).join('\n')}`);
      process.exit(1);
    }
    matches.forEach((f) => { if (!picked.includes(f)) picked.push(f); });
  }

  const nonIdempotent = picked.filter((f) => f.includes('NOT_IDEMPOTENT'));
  console.log(`Running ${picked.length} test case(s):\n${picked.map((f) => `  ${f}`).join('\n')}`);
  if (nonIdempotent.length) {
    console.log(`Note: NOT_IDEMPOTENT (leaves data behind in the demo workspace): ${nonIdempotent.join(", ")}`);
  }

  const testPaths = picked.map((f) => `test-cases/${f}`);
  const command = process.env.VM ? './scripts/vm/run-tests.sh' : 'npx';
  const commandArgs = process.env.VM ? [...testPaths, ...playwrightArgs] : ['playwright', 'test', ...testPaths, ...playwrightArgs];
  const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit' });
  process.exit(result.status === null ? 1 : result.status);
}

main();
