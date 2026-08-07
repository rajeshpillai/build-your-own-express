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
echo "step 22 — static files, and the escape attempt"

check "index.html is served"        '200' -o /dev/null -w '%{http_code}' "$BASE/"
check "and it is html"              'text/html; charset=utf-8' \
      -o /dev/null -w '%{content_type}' "$BASE/"
check "a nested file is served"     '200' -o /dev/null -w '%{http_code}' \
      "$BASE/assets/site.css"
check "with the right type"         'text/css; charset=utf-8' \
      -o /dev/null -w '%{content_type}' "$BASE/assets/site.css"
check "a route below still works"   'a route, not a file'  "$BASE/hello"
check "a missing file falls through" '404' -o /dev/null -w '%{http_code}' \
      "$BASE/nope.css"

# The whole reason this layer is written rather than imported.
check "../ cannot escape the root"  '404' -o /dev/null -w '%{http_code}' \
      --path-as-is "$BASE/../secret.txt"
check "nor can it encoded"          '404' -o /dev/null -w '%{http_code}' \
      --path-as-is "$BASE/%2e%2e%2fsecret.txt"
check "nor a sibling directory"     '404' -o /dev/null -w '%{http_code}' \
      --path-as-is "$BASE/../publicX/index.html"
check "HEAD sends no body"          '0' -o /dev/null -w '%{size_download}' \
      -I "$BASE/"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
