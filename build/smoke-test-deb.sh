#!/bin/bash
# Start the packaged binary twice and confirm which client it serves.
# systemd is not used: GitHub-hosted runners are not a useful systemctl target,
# and postinst only starts the service.
set -euo pipefail

deb="${1:?Usage: build/smoke-test-deb.sh <audiobookshelf_*_amd64.deb>}"
if [ ! -f "$deb" ]; then
  echo "Debian package not found: $deb"
  exit 1
fi

root="$(mktemp -d)"
dpkg-deb -x "$deb" "$root"
bin="$root/usr/share/audiobookshelf/audiobookshelf"
react_dir="$root/usr/share/audiobookshelf/client-react"

if [ ! -x "$bin" ]; then
  echo "Package binary is missing or not executable: $bin"
  exit 1
fi
if [ ! -f "$react_dir/node_modules/next/package.json" ]; then
  echo "Package is missing the React client runtime: $react_dir"
  exit 1
fi

pids=()
cleanup() {
  local pid
  for pid in "${pids[@]+"${pids[@]}"}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

# /healthcheck is 200 for either client once the process is listening.
# The page body is what distinguishes the packed Vue client from the Next client.
assert_client() {
  local port="$1"
  local marker="$2"
  local label="$3"
  local page
  if ! page="$(curl -sfL --max-time 30 "http://127.0.0.1:${port}/")"; then
    echo "$label did not return a page"
    return 1
  fi
  if ! printf '%s' "$page" | grep -q "$marker"; then
    echo "$label page did not contain $marker"
    printf '%s\n' "$page" | head -n 40
    return 1
  fi
}

start_case() {
  local label="$1"
  local port="$2"
  local react_path="${3:-}"
  local work log pid ready
  work="$(mktemp -d)"
  log="$work/server.log"
  mkdir -p "$work/home" "$work/config" "$work/metadata"

  echo ">>> $label"
  if [ -n "$react_path" ]; then
    env \
      HOME="$work/home" \
      HOST=127.0.0.1 \
      PORT="$port" \
      CONFIG_PATH="$work/config" \
      METADATA_PATH="$work/metadata" \
      REACT_CLIENT_PATH="$react_path" \
      "$bin" >"$log" 2>&1 &
  else
    env -u REACT_CLIENT_PATH \
      HOME="$work/home" \
      HOST=127.0.0.1 \
      PORT="$port" \
      CONFIG_PATH="$work/config" \
      METADATA_PATH="$work/metadata" \
      "$bin" >"$log" 2>&1 &
  fi
  pid=$!
  pids+=("$pid")

  ready=0
  for _ in $(seq 1 240); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "$label exited before it was healthy"
      tail -n 120 "$log" || true
      return 1
    fi
    if curl -sf --max-time 5 "http://127.0.0.1:${port}/healthcheck" >/dev/null; then
      ready=1
      break
    fi
    sleep 2
  done
  if [ "$ready" != 1 ]; then
    echo "$label did not become healthy"
    tail -n 120 "$log" || true
    return 1
  fi

  if [ -n "$react_path" ]; then
    assert_client "$port" '/_next/' "$label" || {
      tail -n 120 "$log" || true
      return 1
    }
  else
    assert_client "$port" '/_nuxt/' "$label" || {
      tail -n 120 "$log" || true
      return 1
    }
  fi

  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
  echo "$label ok"
}

start_case "Vue client" 18080
start_case "React client" 18081 "$react_dir"
echo "Smoke test passed"
