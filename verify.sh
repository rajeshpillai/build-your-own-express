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

# A file big enough that it cannot leave in one write. Back pressure only exists
# once the socket says stop, and a small file never makes it say so.
BIG="public/assets/big.txt"
head -c 3000000 /dev/zero | tr '\0' 'x' > "$BIG"
trap 'stop; rm -rf "$FIXDIR" "$BIG"' EXIT

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

echo "step 31 — writing in pieces, on node:http"

check "a static file is served"     '200' -o /dev/null -w '%{http_code}' \
      "$BASE/assets/site.css"
check "a large file arrives whole"  '3000000' -o /dev/null -w '%{size_download}' \
      "$BASE/assets/big.txt"
stop

echo
echo "step 31 — and the same, on uWebSockets.js"

TRANSPORT=uws
fresh_store phase1
start

check "a static file is served"     '200' -o /dev/null -w '%{http_code}' \
      "$BASE/assets/site.css"
contains "and its bytes are right"  'font-family' "$BASE/assets/site.css"
check "its type is still guessed"   'text/css; charset=utf-8' \
      -o /dev/null -w '%{content_type}' "$BASE/assets/site.css"

# Three megabytes cannot leave in a single write, so this exercises the write
# path in pieces rather than the single-shot end().
#
# It does NOT prove back pressure is respected, and saying so matters. uWS
# buffers whatever a writer refuses to pause for, so the client receives every
# byte either way — confirmed by ignoring the return value and watching all three
# million still arrive. What obeying it changes is whose memory holds the
# remainder, and no assertion on the response can see that.
check "a large file arrives whole"  '3000000' -o /dev/null -w '%{size_download}' \
      "$BASE/assets/big.txt"

# And byte for byte, because a length can be right while the content is not.
curl -sS -o "$FIXDIR/big.out" "$BASE/assets/big.txt" 2>/dev/null
if cmp -s "$BIG" "$FIXDIR/big.out"; then
  printf '  ok    and byte for byte identical\n'
else
  printf '  FAIL  and byte for byte identical\n'; FAILED=1
fi

check "bodies still work"           '[]' "$BASE/api/links"
made=$(made_code "https://example.com")
if [ "${#made}" -eq 7 ]; then
  printf '  ok    and so do posts\n'
else
  printf '  FAIL  and so do posts (got %s)\n' "$made"; FAILED=1
fi

# uWS warns on every write made outside a cork. The warnings are the only sign,
# and they go to stderr where nobody reads them.
if grep -q "corked callback" /tmp/rocket-verify.log 2>/dev/null; then
  printf '  FAIL  uWS warned about uncorked writes\n'; FAILED=1
else
  printf '  ok    no uncorked writes\n'
fi
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
