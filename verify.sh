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

# A body large enough that the kernel hands it over in several chunks rather than
# one. That is the whole reason read() collects and concatenates.
BIG=/tmp/rocket-big.txt
head -c 100000 /dev/zero | tr '\0' 'x' > "$BIG"

# Step 16 — one byte over the hundred-kilobyte ceiling, and comfortably over it.
OVER=/tmp/rocket-over.txt
head -c 102401 /dev/zero | tr '\0' 'x' > "$OVER"
HUGE=/tmp/rocket-huge.txt
head -c 5000000 /dev/zero | tr '\0' 'x' > "$HUGE"

start
echo "step 17 — the middleware stack"

check "middleware runs before routes"  '{"stamps":["first","second"]}'  "$BASE/stamps"
check "and in registration order"      'first,second' \
      -o /dev/null --write-out '%header{x-rocket-stamps}' "$BASE/stamps"
check "a route still answers"          'Home'  "$BASE/"
check "the stack is inspectable"       '{"middleware":3,"routes":3}'  "$BASE/stack"
check "middleware sees a 404 too"      'first,second' \
      -o /dev/null "$BASE/nope" --write-out '%header{x-rocket-stamps}'
check "and the 404 still happens"      '404' -o /dev/null -w '%{http_code}' "$BASE/nope"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
