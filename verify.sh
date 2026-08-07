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

# Assertions about a substring rather than a whole body — a rendered page carries
# markup around the value being checked.
contains() {
  local label="$1" needle="$2"; shift 2
  local actual
  actual=$(curl -sS "$@" 2>/dev/null)
  case "$actual" in
    *"$needle"*) printf '  ok    %s\n' "$label" ;;
    *) printf '  FAIL  %s\n        wanted to contain: %s\n' "$label" "$needle"
       FAILED=1 ;;
  esac
}

start
echo "step 25 — a page, and the engine you chose"

check "a template renders"          '200' -o /dev/null -w '%{http_code}' "$BASE/page"
check "and is sent as html"         'text/html; charset=utf-8' \
      -o /dev/null -w '%{content_type}' "$BASE/page"
contains "the title was filled in"  '<h1>A page</h1>'  "$BASE/page"
contains "a nested value too"       '<p>by Ada</p>'    "$BASE/page"
contains "escaping is the default"  '&lt;script&gt;'   "$BASE/unsafe"
check "a missing value is empty"    '200' -o /dev/null -w '%{http_code}' "$BASE/unsafe"
check "a setting reads back"        '{"views":"views"}'  "$BASE/settings"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
