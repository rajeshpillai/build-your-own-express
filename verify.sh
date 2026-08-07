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

# Step 25.1 needs two packages, because the whole claim is that real engines fit.
# Installing them here rather than assuming them: a clean clone has no
# node_modules, and a check that quietly skips when a package is missing reports
# success for the one case it exists to test.
if ! node -e "require.resolve('handlebars'); require.resolve('ejs')" 2>/dev/null; then
  # --no-save, because a plain install rewrites package-lock.json — and a
  # modified lock makes `git checkout step-NN` refuse to move, which is the
  # one thing this course asks everybody to do.
  echo "  installing handlebars and ejs (this step needs them)"
  npm install --no-save --silent --no-audit --no-fund >/dev/null 2>&1
fi
if ! node -e "require.resolve('handlebars'); require.resolve('ejs')" 2>/dev/null; then
  echo "  FAIL  handlebars and ejs are not installed and could not be installed"
  echo "        this step is about running real engines, so there is nothing to check"
  exit 1
fi

# The same assertions against each engine in turn. The point is not that any one
# of them works. It is that the identical checks pass on all three, with one line
# of the application different between them.
for ENGINE in tiny hbs ejs; do
  export ENGINE
  start
  echo
  echo "step 25.1 — the seam, running on $ENGINE"

  check "the engine really is $ENGINE" "{\"engine\":\"$ENGINE\"}" "$BASE/engine"
  check "a template renders"          '200' -o /dev/null -w '%{http_code}' "$BASE/page"
  check "and is sent as html"         'text/html; charset=utf-8' \
        -o /dev/null -w '%{content_type}' "$BASE/page"
  contains "the title was filled in"  '<h1>A page</h1>'  "$BASE/page"
  contains "a nested value too"       '<p>by Ada</p>'    "$BASE/page"
  contains "escaping is the default"  '&lt;script&gt;'   "$BASE/unsafe"
  check "a setting reads back"        '{"views":"views"}'  "$BASE/settings"

  # Containing the escaped form would also pass if the page carried BOTH forms,
  # which is the shape a half-working escape produces. Require the raw tag to be
  # absent as well.
  raw=$(curl -sS "$BASE/unsafe" 2>/dev/null)
  case "$raw" in
    *"<script>"*) printf '  FAIL  the raw tag reached the page as well\n'; FAILED=1 ;;
    *) printf '  ok    and no raw script tag survived\n' ;;
  esac

  stop
done
unset ENGINE

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
