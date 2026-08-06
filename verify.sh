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

# Some assertions are about a substring rather than the whole body — the log lines
# carry a timing that changes on every run, so comparing the whole thing would be a
# check that fails at random.
contains() {
  local label="$1" needle="$2"; shift 2
  local actual
  actual=$(curl -sS "$@" 2>/dev/null)
  case "$actual" in
    *"$needle"*) printf '  ok    %s\n' "$label" ;;
    *) printf '  FAIL  %s\n        wanted to contain: %s\n        actual: %s\n' \
              "$label" "$needle" "$actual"; FAILED=1 ;;
  esac
}

BIG=/tmp/rocket-over.txt
head -c 102401 /dev/zero | tr '\0' 'x' > "$BIG"

start
echo "step 21 — the framework's own work, as layers"

check "a route still answers"        'Home'  "$BASE/"
check "the parser layer fills body"  '{"got":{"name":"Ada"}}' \
      -X POST -H 'Content-Type: application/json' -d '{"name":"Ada"}' "$BASE/echo"
check "a form still works"           '{"got":{"name":"Ada"}}' \
      -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
      -d 'name=Ada' "$BASE/echo"
check "broken json is still a 400"   '400' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/json' -d '{"name":' "$BASE/echo"
check "the ceiling still binds"      '413' -o /dev/null -w '%{http_code}' \
      -X POST -H 'Content-Type: application/octet-stream' \
      --data-binary @"$BIG" "$BASE/echo"

# Prime the log with one miss and one hit, then read it back.
curl -sS -o /dev/null "$BASE/nope"
curl -sS -o /dev/null "$BASE/"
contains "the logger saw the 404"    'GET /nope 404'  "$BASE/log"
contains "and it logged a 200 too"   'GET / 200'      "$BASE/log"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
