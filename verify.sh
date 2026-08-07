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

# Fixtures this step uploads. Made here rather than assumed, because a check that
# reads a file somebody else left behind passes on the machine that left it and
# fails on a clean clone — which is what happened, and it was invisible because
# the file was still there from the session that wrote the step.
FIX="$(mktemp -d)"
trap 'stop; rm -rf "$FIX"' EXIT
printf 'the exact bytes of this file matter' > "$FIX/up-a.txt"
printf '\x00\x01\x02\xfd\xfe\xff\x0d\x0a\x00\xff\x7f' > "$FIX/up-bin.bin"

start
echo "step 21.2 — filenames you cannot trust, and a limit per part"

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

# Step 21.2. A filename is whatever the client typed, so each of these is a real
# string a real client can send. curl will not put a path in a filename= for us,
# so the bodies below are written by hand — which is also the clearest way to see
# that the dangerous part is just characters in a header.
echo
echo "  the filename is data"

# One part, with whatever filename we are testing. Written by hand because curl
# will not put a path into a filename= for us — which is itself worth noticing:
# the tool refuses, and a hand-written client simply does it.
DISP='Content-Disposition: form-data; name="f"; filename="%s"'
PART="--X\r\n$DISP\r\n\r\nx\r\n--X--\r\n"

part_named() { printf -- "$PART" "$1" > "$FIX/body.bin"; }

traversal() {
  local label="$1" sent="$2" want="$3"
  part_named "$sent"
  contains "$label" "$want" -X POST \
    -H 'Content-Type: multipart/form-data; boundary=X' \
    --data-binary "@$FIX/body.bin" "$BASE/store"
}

traversal "a path climbing out is reduced to its last piece" \
          '../../etc/passwd'   '"wouldWriteTo":"uploads/passwd"'
traversal "a Windows path is a path too"  \
          'C:\\Windows\\evil.dll'  '"wouldWriteTo":"uploads/evil.dll"'
traversal "a name that is only dots falls back" \
          '..'                 '"wouldWriteTo":"uploads/upload"'
traversal "an empty name falls back" \
          ''                   '"wouldWriteTo":"uploads/upload"'

# The claimed name is still reported, because throwing it away would stop an
# application ever showing a person what they uploaded.
part_named '../../etc/passwd'
contains "and the claimed name is kept" '"clientName":"../../etc/passwd"' \
  -X POST -H 'Content-Type: multipart/form-data; boundary=X' \
  --data-binary "@$FIX/body.bin" "$BASE/upload"

echo
echo "  the counts the body ceiling says nothing about"

# Four files, under a limit of three. Every one of these is tiny, so the whole
# body is far inside the step 16 ceiling — which is the point being made.
check "a fourth file is refused"   '413' \
      -X POST -F "a=@$FIX/up-a.txt" -F "b=@$FIX/up-a.txt" \
              -F "c=@$FIX/up-a.txt" -F "d=@$FIX/up-a.txt" \
      -o /dev/null -w '%{http_code}' "$BASE/upload"
check "three files are still fine" '200' \
      -X POST -F "a=@$FIX/up-a.txt" -F "b=@$FIX/up-a.txt" -F "c=@$FIX/up-a.txt" \
      -o /dev/null -w '%{http_code}' "$BASE/upload"
check "a sixth field is refused"   '413' \
      -X POST -F 'a=1' -F 'b=2' -F 'c=3' -F 'd=4' -F 'e=5' -F 'f=6' \
      -o /dev/null -w '%{http_code}' "$BASE/upload"

# One file over the per-file ceiling, in a body under the whole-body ceiling.
# Without a per-part limit this is a 200, which is the hole being closed.
head -c 30000 /dev/zero | tr '\0' 'a' > "$FIX/big.txt"
check "a file over its own ceiling is refused" '413' \
      -X POST -F "doc=@$FIX/big.txt" -o /dev/null -w '%{http_code}' "$BASE/upload"
check "and the whole body was under the body ceiling" '200' \
      -X POST -H 'Content-Type: text/plain' --data-binary "@$FIX/big.txt" \
      -o /dev/null -w '%{http_code}' "$BASE/json"

[ "$FAILED" -eq 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit "$FAILED"
