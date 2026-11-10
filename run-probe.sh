#!/bin/bash
# Run a node probe script through the local proxy (same as run-tests.sh).
cd "$(dirname "$0")"
node local-proxy.js 8888 > /tmp/bearon-local-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 2
PLAYWRIGHT_PROXY=http://127.0.0.1:8888 node "$@"
echo "PROBE_EXIT=$?"
