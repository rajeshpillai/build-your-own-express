#!/usr/bin/env bash
# Assertions for this step. Run by the course build, and by anyone who clones this.
#
#   ./verify.sh            starts the step's server, checks it, stops it
#   PORT=4000 ./verify.sh  on another port
#
# A step that cannot answer these is broken, and a broken step is a lecture that
# teaches something that does not work.

set -uo pipefail

PORT="${PORT:-3000}"
ENTRY="${ENTRY:-app.js}"
BASE="http://localhost:$PORT"
FAILED=0

start() {
  PORT="$PORT" node "$ENTRY" >/tmp/rocket-verify.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do
    curl -sS -o /dev/null "$BASE/" 2>/dev/null && return 0
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 0.1
  done
  echo "server did not come up on port $PORT"
  cat /tmp/rocket-verify.log
  exit 1
}

stop() { kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; }
trap stop EXIT

# check <label> <expected> <curl args...>
check() {
  local label="$1" expected="$2"; shift 2
  local actual
  actual=$(curl -sS "$@" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    printf '  ok    %s\n' "$label"
  else
    printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$label" "$expected" "$actual"
    FAILED=1
  fi
}

start
echo "step 18 — implementing the chain"

check "the chain runs in order"        '{"stamps":["first","second","third"]}' \
      "$BASE/stamps"
check "async middleware is awaited"    '{"stamps":["first","second","third"]}' \
      "$BASE/stamps"
check "not calling next stops it"      '401' -o /dev/null -w '%{http_code}' \
      "$BASE/locked"
check "and the route never ran"        'Not for you'  "$BASE/locked"
check "a throw becomes a 500"          '500' -o /dev/null -w '%{http_code}' \
      "$BASE/boom"
check "an async throw does too"        '500' -o /dev/null -w '%{http_code}' \
      "$BASE/boom-async"
check "the process survived both"      'Home'  "$BASE/"
check "and routing still works"        '404' -o /dev/null -w '%{http_code}' \
      "$BASE/nope"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
