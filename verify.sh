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
echo "step 16 — the size limit"

check "json becomes an object"       '{"got":{"name":"Ada"},"type":"object"}' \
      -X POST -H 'Content-Type: application/json' -d '{"name":"Ada"}' "$BASE/json"
check "a charset parameter is fine"  '{"got":{"name":"Ada"},"type":"object"}' \
      -X POST -H 'Content-Type: application/json; charset=utf-8' \
      -d '{"name":"Ada"}' "$BASE/json"
check "a form becomes an object"     '{"name":"Ada","city":"London"}' \
      -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
      -d 'name=Ada&city=London' "$BASE/form"
check "urlencoding is decoded"       '{"name":"Ada Lovelace"}' \
      -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
      -d 'name=Ada%20Lovelace' "$BASE/form"
check "text stays a string"          '{"body":"café latte","type":"string"}' \
      -X POST -H 'Content-Type: text/plain' -d 'café latte' "$BASE/text"
check "an unknown type stays bytes"  '{"bytes":100000,"isBuffer":true}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$BIG" "$BASE/bytes"
check "broken json is a 400"         '400' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/json' -d '{"name":' "$BASE/json"
check "and it says so"               'Invalid body' \
      -X POST -H 'Content-Type: application/json' -d '{"name":' "$BASE/json"
check "an empty body is undefined"   '{"type":"undefined"}' \
      -X POST -H 'Content-Type: application/json' -d '' "$BASE/json"
check "get still works"              'Home' "$BASE/"
check "the ceiling is 102400"        '{"limit":102400}' "$BASE/limit"
check "just under is accepted"       '{"bytes":100000,"isBuffer":true}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$BIG" "$BASE/bytes"
check "one byte over is a 413"       '413' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$OVER" "$BASE/bytes"
check "and it says which failure"    'Body too large' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$OVER" "$BASE/bytes"
check "five megabytes is refused"    '413' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$HUGE" "$BASE/bytes"
check "a lying Content-Length too"   '413' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      -H 'Transfer-Encoding: chunked' -H 'Expect:' --data-binary @"$HUGE" "$BASE/bytes"
check "the server is still up"       'Home' "$BASE/"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
