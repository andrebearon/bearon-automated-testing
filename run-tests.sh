#!/bin/bash
# Run Playwright tests through the local proxy WITHOUT sourcing .env
# (session is already saved in auth/.storage-state.json; tests use it only).
# Usage: ./run-tests.sh [playwright test args...]
cd "$(dirname "$0")"
node local-proxy.js 8888 > /tmp/bearon-local-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 2
PLAYWRIGHT_PROXY=http://127.0.0.1:8888 npx playwright test "$@"
echo "PLAYWRIGHT_EXIT=$?"
