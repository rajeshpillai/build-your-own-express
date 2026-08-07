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
# The code is random, so no check may assume its value. Make a link, read the code
# back out of the answer, and use that. A test that knew the code in advance would
# be testing a counter this course no longer has.
made_code() {
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"target\":\"$1\"}" "$BASE/api/links" \
    | sed -n 's/.*"code":"\([^"]*\)".*/\1/p'
}

echo "step 28 — what building on it taught us"

contains "the page surface renders"  '<form method="post"'  "$BASE/"
check "the API lists, as JSON"       '[]'  "$BASE/api/links"
check "the API creates"              '201' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/json' \
      -d '{"target":"https://example.com/api"}' "$BASE/api/links"
# Relative, like every Location this framework sends. The code is random, so what
# is checked is that the header names a resource of the right shape rather than a
# value somebody could have predicted.
loc=$(curl -sS -o /dev/null -w '%header{location}' \
      -X POST -H 'Content-Type: application/json' \
      -d '{"target":"https://example.com/two"}' "$BASE/api/links")
case "$loc" in
  /api/links/???????) printf '  ok    and says where it put it\n' ;;
  *) printf '  FAIL  and says where it put it (got %s)\n' "$loc"; FAILED=1 ;;
esac
code=$(made_code "https://example.com/api")
contains "the API reads one back"    '"target":"https://example.com/api"' \
      "$BASE/api/links/$code"
check "a bad target is JSON too"     '{"error":"a target starting with http is required"}' \
      -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/links"
check "the page surface redirects"   '302' -o /dev/null -w '%{http_code}' "$BASE/$code"
check "a form post still renders"    '200' -o /dev/null -w '%{http_code}' \
      -X POST -d 'target=https://example.com/form' "$BASE/links"
check "/links is not read as a code" '400' -o /dev/null -w '%{http_code}' \
      -X POST -d 'target=nope' "$BASE/links"
check "an unknown API path 404s"     '404' -o /dev/null -w '%{http_code}' \
      "$BASE/api/nope"
check "and the 404 names it fully"   'Cannot GET /api/nope'  "$BASE/api/nope"
check "a router goes in directly"    '200' -o /dev/null -w '%{http_code}' \
      "$BASE/api/links"
check "and the old wrapper still works" '200' -o /dev/null -w '%{http_code}' \
      "$BASE/v2/links"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
