#!/bin/bash
# Run several read-only probes sequentially under ONE local proxy instance.
# Output is tee'd to /tmp/bearon-probes-<date>.log
cd "$(dirname "$0")"
node local-proxy.js 8888 > /tmp/bearon-local-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 2
export PLAYWRIGHT_PROXY=http://127.0.0.1:8888
LOG="/tmp/bearon-probes-$(date +%H%M%S).log"
echo "LOG=$LOG"
for f in "$@"; do
  echo "########## PROBE: $f ##########" | tee -a "$LOG"
  node "$f" 2>&1 | tee -a "$LOG"
  echo "PROBE_EXIT=$?" | tee -a "$LOG"
done
echo "ALL PROBES DONE log=$LOG"
