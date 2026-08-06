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
echo "step 20 — error middleware"

check "a normal route is untouched"    'Home'  "$BASE/"
check "next(err) reaches a handler"    '403' -o /dev/null -w '%{http_code}' \
      "$BASE/rejected"
check "and the handler saw the error"  '{"error":"not allowed","request":"req-1"}' \
      "$BASE/rejected"
check "a throw lands in the fallback"  '500' -o /dev/null -w '%{http_code}' \
      "$BASE/boom"
check "which says nothing private"     '{"error":"Something failed","request":"req-1"}' \
      "$BASE/boom"
check "an async throw goes there too"  '{"error":"Something failed","request":"req-1"}' \
      "$BASE/boom-async"
check "so does a route that throws"    '{"error":"Something failed","request":"req-1"}' \
      "$BASE/route-boom"
check "404 is not an error"            '404' -o /dev/null -w '%{http_code}' \
      "$BASE/nope"
check "the server is still up"         'Home'  "$BASE/"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
