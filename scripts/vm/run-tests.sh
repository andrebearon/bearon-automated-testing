#!/bin/bash
# VM-only: run Playwright through the local CONNECT proxy (see local-proxy.js).
# On a normal machine use `npm test` instead.
# Usage: ./scripts/vm/run-tests.sh [playwright test args...]
cd "$(dirname "$0")/../.."
node scripts/vm/local-proxy.js 8888 > /tmp/bearon-local-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 2
PLAYWRIGHT_PROXY=http://127.0.0.1:8888 npx playwright test "$@"
echo "PLAYWRIGHT_EXIT=$?"
