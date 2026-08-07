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
  PORT="$PORT" TRANSPORT="${TRANSPORT:-}" node "$ENTRY" >/tmp/rocket-verify.log 2>&1 &
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
FIXDIR="$(mktemp -d)"
# Step 28.3 — the store is a file now. Before that step, restarting the server
# emptied it; now it does not, which is the entire point of the step and the
# reason this helper had to exist. Each phase gets its own file, so a check that
# expects an empty store still gets one.
fresh_store() { export LINKS_FILE="$FIXDIR/links-$RANDOM-$1.json"; }
trap 'stop; rm -rf "$FIXDIR"' EXIT

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

# Six packages, four of them written for Express. Installing rather than assuming
# them: a clean clone has no node_modules, and a check that skips when a package
# is missing reports success for exactly the case it exists to test.
# uWebSockets.js is in this list from step 29 because rocket/ imports its
# transport at module load: without it the server does not start on ANY
# transport, and the error names a package nobody was asked to install.
NEEDED="cors cookie-parser morgan multer handlebars ejs uWebSockets.js"
have_all() { for p in $NEEDED; do node -e "require.resolve('$p')" 2>/dev/null || return 1; done; }
if ! have_all; then
  # --no-save, because a plain install rewrites package-lock.json — and a
  # modified lock makes `git checkout step-NN` refuse to move, which is the
  # one thing this course asks everybody to do.
  echo "  installing the packages this step runs on"
  npm install --no-save --silent --no-audit --no-fund >/dev/null 2>&1
fi
if ! have_all; then
  echo "  FAIL  the packages could not be installed"
  echo "        this step is about running real Express middleware, so there is nothing to check"
  exit 1
fi

fresh_store phase1
start
# The code is random, so no check may assume its value. Make a link, read the code
# back out of the answer, and use that. A test that knew the code in advance would
# be testing a counter this course no longer has.
made_code() {
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"target\":\"$1\"}" "$BASE/api/links" \
    | sed -n 's/.*"code":"\([^"]*\)".*/\1/p'
}

echo "step 29 — the same application, on node:http"

check "a page renders"              '200' -o /dev/null -w '%{http_code}' "$BASE/"
check "the api answers"             '[]' "$BASE/api/links"

# Step 28.2 — a refusal is a page. It carries the message, and it still has the
# form on it with what was typed left in the box.
bad=$(curl -sS -X POST -d 'target=not-a-url' "$BASE/links")
case "$bad" in
  *"has to start with http"*) printf '  ok    a refusal says what is wrong\n' ;;
  *) printf '  FAIL  a refusal says what is wrong\n'; FAILED=1 ;;
esac
case "$bad" in
  *'value="not-a-url"'*) printf '  ok    and keeps what was typed\n' ;;
  *) printf '  FAIL  and keeps what was typed\n'; FAILED=1 ;;
esac
# The value goes back through two braces, so markup in it comes back inert.
raw=$(curl -sS -X POST --data-urlencode 'target=<script>x</script>' "$BASE/links")
case "$raw" in
  *"<script>x</script>"*) printf '  FAIL  a typed script tag is escaped\n'; FAILED=1 ;;
  *) printf '  ok    a typed script tag is escaped\n' ;;
esac
contains "an unknown code gets a page" 'No such link'  "$BASE/zzzzzzz"
check "and that page is a 404"      '404' -o /dev/null -w '%{http_code}' "$BASE/zzzzzzz"
made=$(made_code "https://example.com")
if [ "${#made}" -eq 7 ]; then
  printf '  ok    a link can be made\n'
else
  printf '  FAIL  a link can be made (got %s)\n' "$made"; FAILED=1
fi
code=$(made_code "https://example.com/api")
check "and it redirects"            '302' -o /dev/null -w '%{http_code}' "$BASE/$code"
check "an unknown path is 404"      '404' -o /dev/null -w '%{http_code}' "$BASE/api/nope"
stop

# The same assertions that do not need a body, against uWebSockets.js. The point
# is that the router, the response prototype and the middleware chain are
# untouched: only the thing underneath them changed.
echo
echo "step 29 — and the same routes on uWebSockets.js"

TRANSPORT=uws
fresh_store phase1
start

check "a page renders"              '200' -o /dev/null -w '%{http_code}' "$BASE/"
check "the api answers"             '[]' "$BASE/api/links"
check "a route parameter arrives"   '{"error":"no such link"}' "$BASE/api/links/nope"
check "an unknown path is 404"      '404' -o /dev/null -w '%{http_code}' "$BASE/api/nope"
contains "and the 404 names it"     'Cannot GET /api/nope' "$BASE/api/nope"
# Not checked here: a static file. The static layer pipes a read stream into the
# response, and this transport has no stream to pipe into yet — writing in pieces
# with back pressure is step 31. Saying so beats a check that quietly passes
# because it asked for something easy.

# Sending Content-Length ourselves as well as letting uWS compute one puts the
# header in the response twice. Nothing warns; a client is simply entitled to
# reject it. The first port of the transport did exactly that.
n=$(curl -sS -D- -o /dev/null "$BASE/api/links" 2>/dev/null | grep -ci '^content-length:')
if [ "$n" = "1" ]; then printf '  ok    content-length appears once\n'
else printf '  FAIL  content-length appears %s times\n' "$n"; FAILED=1; fi
stop

# Step 28.3 — the claim of this step, checked the only way it can be: make a link,
# stop the process, start another one, and ask for it again. On a Map this could
# not have passed, and that is the whole point.
#
# Self-contained on purpose. It brings its own server up and down, so it does not
# care which phase ran before it — later steps inherit this block and run several.
#
# On node:http deliberately. What is being checked is that the store keeps a link,
# not which server handed it over, and a later step leaves the uWS transport
# selected — which cannot read a POST body until the step after that one.
stop
unset TRANSPORT
fresh_store keep
start
kept=$(made_code "https://example.com/survives")
stop
start
case "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/$kept")" in
  302) printf '  ok    a link outlives the process\n' ;;
  *) printf '  FAIL  a link outlives the process\n'; FAILED=1 ;;
esac
check "and still names its target"  'https://example.com/survives' \
      -o /dev/null -w '%header{location}' "$BASE/$kept"
stop

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
