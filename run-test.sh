#!/bin/bash
# VM wrapper: start the local CONNECT proxy, run the test, stop the proxy.
# On a normal machine, just run `npm test` directly (no proxy needed).
set -e
cd "$(dirname "$0")"
node local-proxy.js 8888 > /tmp/bearon-local-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 2
set -a; . ./.env 2>/dev/null || true; set +a
PLAYWRIGHT_PROXY=http://127.0.0.1:8888 npx playwright test "$@"
