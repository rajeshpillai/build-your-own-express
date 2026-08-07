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
# The code is random now, so no check may assume its value. Make a link, read the
# code back out of the page, and use that. A test that knew the code in advance
# would be testing the counter this step removed.
made_code() {
  curl -sS -X POST -d "target=$1" "$BASE/links" \
    | sed -n 's|.*href="/\([^"]*\)".*|\1|p' | head -1
}

echo "step 26 — a URL shortener on the framework"

contains "the form page renders"    '<form method="post" action="/links">'  "$BASE/"
contains "and counts the links"     '0 link(s) so far.'  "$BASE/"
check "a bad target is refused"     '400' -o /dev/null -w '%{http_code}' \
      -X POST -d 'target=not-a-url' "$BASE/links"
check "an empty target too"         '400' -o /dev/null -w '%{http_code}' \
      -X POST -d '' "$BASE/links"
contains "a link is made"           'goes to https://example.com/one' \
      -X POST -d 'target=https://example.com/one' "$BASE/links"

code=$(made_code "https://example.com/two")
if [ "${#code}" -eq 7 ]; then
  printf '  ok    the code is seven characters\n'
else
  printf '  FAIL  the code is seven characters (got %s)\n' "$code"; FAILED=1
fi
case "$code" in
  *[01OlI]*) printf '  FAIL  the alphabet excludes look-alikes\n'; FAILED=1 ;;
  *) printf '  ok    the alphabet excludes look-alikes\n' ;;
esac
check "the code redirects"          '302' -o /dev/null -w '%{http_code}' "$BASE/$code"
check "and names the target"        'https://example.com/two' \
      -o /dev/null -w '%{redirect_url}' "$BASE/$code"
# Two links with the same target must not share a code: these are addresses, not
# a cache. It also proves the generator is not quietly deterministic.
other=$(made_code "https://example.com/two")
if [ "$code" != "$other" ]; then
  printf '  ok    two links get two codes\n'
else
  printf '  FAIL  two links get two codes\n'; FAILED=1
fi
check "an unknown code is a 404"    '404' -o /dev/null -w '%{http_code}' "$BASE/zzz"
contains "the count went up"        '3 link(s) so far.'  "$BASE/"
check "a static file still wins"    '200' -o /dev/null -w '%{http_code}' \
      "$BASE/assets/site.css"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
