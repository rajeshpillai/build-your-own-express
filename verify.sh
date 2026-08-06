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
ENTRY="${ENTRY:-server.js}"
BASE="http://localhost:$PORT"
FAILED=0

start() {
  PORT="$PORT" node "$ENTRY" >/tmp/rocket-verify.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do
    curl -fsS -o /dev/null "$BASE/" 2>/dev/null && return 0
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
echo "step 1 — a server, and everything you do by hand"

check "GET /            -> Home"          'Home'                            "$BASE/"
check "GET /users       -> both users"    '[{"id":"1","name":"Ada"},{"id":"2","name":"Grace"}]' "$BASE/users"
check "GET /users/2     -> Grace"         '{"id":"2","name":"Grace"}'       "$BASE/users/2"
check "GET /users/99    -> no such user"  'No such user'                    "$BASE/users/99"
check "GET /nope        -> not found"     'Not found'                       "$BASE/nope"
check "GET /users/2 status is 200"        '200'  -o /dev/null -w '%{http_code}' "$BASE/users/2"
check "GET /nope status is 404"           '404'  -o /dev/null -w '%{http_code}' "$BASE/nope"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
