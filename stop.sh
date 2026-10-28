#!/usr/bin/env sh
set -eu

PORT="${1:-1236}"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PIDFILE="$ROOT/data/token-counter-$PORT.pid"

listener_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v port=":$PORT" '$4 ~ port { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART + 4, RLENGTH - 4) } }' | sort -u
  fi
}

port_in_use() {
  [ -n "$(listener_pids)" ]
}

is_token_lens() {
  command_line=$(ps -p "$1" -o command= 2>/dev/null || true)
  case "$command_line" in
    *"server/index.js"*) return 0 ;;
    *) return 1 ;;
  esac
}

if ! port_in_use; then
  echo "[Token Lens] No server is listening on port $PORT."
  rm -f "$PIDFILE"
  exit 1
fi

MATCHED=""
for pid in $(listener_pids); do
  if is_token_lens "$pid"; then
    MATCHED="$MATCHED $pid"
  fi
done

if [ -z "$MATCHED" ]; then
  echo "[Token Lens] Port $PORT is used by another process; refusing to stop it."
  echo "[Token Lens] Close that process, or run Token Lens with --port <other-port>."
  exit 1
fi

echo "[Token Lens] Stopping Token Lens on port $PORT..."

if command -v curl >/dev/null 2>&1; then
  curl -fsS -X POST -H "X-Token-Lens: shutdown" "http://127.0.0.1:$PORT/api/shutdown" >/dev/null 2>&1 || true
  i=0
  while [ "$i" -lt 24 ]; do
    sleep 0.15
    port_in_use || break
    i=$((i + 1))
  done
fi

if port_in_use; then
  for pid in $MATCHED; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 0.4
fi

if port_in_use; then
  for pid in $MATCHED; do
    kill -9 "$pid" 2>/dev/null || true
  done
  sleep 0.3
fi

if port_in_use; then
  echo "[Token Lens] Failed to free port $PORT."
  exit 1
fi

rm -f "$PIDFILE"
echo "[Token Lens] Server stopped. Port $PORT is free."
