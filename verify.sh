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
echo "step 19 — route middleware that can refuse"

check "a plain route still works"      'anyone can read this'  "$BASE/open"
check "the guard refuses"              '401' -o /dev/null -w '%{http_code}' \
      "$BASE/secret"
check "and says so"                    'Not for you'  "$BASE/secret"
# 'Not for you' is 11 bytes. If the handler had also run — which is exactly what
# the draft did — the secret would be appended to the refusal in the same socket.
check "nothing was appended to it"     '11' -o /dev/null -w '%{size_download}' \
      "$BASE/secret"
check "with the key it passes"         'the secret' -H 'x-key: open-sesame' \
      "$BASE/secret"
check "layers compose in order"        '{"seen":"stamped"}' \
      -H 'x-key: open-sesame' "$BASE/both"
check "and the guard still binds"      '401' -o /dev/null -w '%{http_code}' \
      "$BASE/both"
check "a declined route 404s"          '404' -o /dev/null -w '%{http_code}' \
      "$BASE/declined"
check "an unknown path still 404s"     '404' -o /dev/null -w '%{http_code}' \
      "$BASE/nope"
check "the server is still up"         'Home'  "$BASE/"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
