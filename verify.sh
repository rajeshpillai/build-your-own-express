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

# Fixtures this step uploads. Made here rather than assumed: a check that reads a
# file somebody else left in /tmp passes on the machine that left it and fails on
# a clean clone, and the failure looks like a broken parser rather than a missing
# file.
FIX="$(mktemp -d)"
trap 'stop; rm -rf "$FIX"' EXIT
printf 'the exact bytes of this file matter' > "$FIX/up-a.txt"
printf '\x00\x01\x02\xfd\xfe\xff\x0d\x0a\x00\xff\x7f' > "$FIX/up-bin.bin"

start
echo "step 21.1 — a file upload, taken apart by hand"

contains "fields and files split" '"filename":"up-a.txt"' \
      -X POST -F 'note=a field' -F "doc=@$FIX/up-a.txt" "$BASE/upload"
contains "the field is there too"  '"note":"a field"' \
      -X POST -F 'note=a field' -F "doc=@$FIX/up-a.txt" "$BASE/upload"
contains "the type is carried"     '"type":"text/plain"' \
      -X POST -F "doc=@$FIX/up-a.txt;type=text/plain" "$BASE/upload"
check "the size is exact"          '35' \
      -X POST -F "doc=@$FIX/up-a.txt" -o /dev/null -w '%{size_download}' \
      "$BASE/echo-file"
check "the bytes are exact"        'the exact bytes of this file matter' \
      -X POST -F "doc=@$FIX/up-a.txt" "$BASE/echo-file"
check "binary survives intact"     '11' \
      -X POST -F "doc=@$FIX/up-bin.bin" -o /dev/null -w '%{size_download}' \
      "$BASE/echo-file"

# Length alone would not catch an off-by-two that shifts the content, so compare the
# bytes. This is the check that would fail if the CRLF before a boundary were kept.
curl -sS -X POST -F "doc=@$FIX/up-bin.bin" -o "$FIX/up-bin.out" "$BASE/echo-file"
if cmp -s "$FIX/up-bin.bin" "$FIX/up-bin.out"; then
  printf '  ok    and byte for byte identical\n'
else
  printf '  FAIL  and byte for byte identical\n'; FAILED=1
fi
contains "both files listed"       '"filename":"up-bin.bin"' \
      -X POST -F "a=@$FIX/up-a.txt" -F "b=@$FIX/up-bin.bin" "$BASE/upload"
check "JSON still goes to the other layer" '{"got":{"still":"ours"}}' \
      -X POST -H 'Content-Type: application/json' -d '{"still":"ours"}' "$BASE/json"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
