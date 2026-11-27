#!/bin/bash
# Start the packaged binary and confirm /healthcheck responds.
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

work="$(mktemp -d)"
mkdir -p "$work/config" "$work/metadata"
log="$work/server.log"

env REACT_CLIENT_PATH="$react_dir" \
  HOST=127.0.0.1 \
  PORT=18080 \
  CONFIG_PATH="$work/config" \
  METADATA_PATH="$work/metadata" \
  "$bin" >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" >/dev/null 2>&1 || true' EXIT

if ! curl -sf --retry 30 --retry-delay 2 --retry-connrefused "http://127.0.0.1:18080/healthcheck" >/dev/null; then
  echo "Server did not respond to /healthcheck"
  tail -n 120 "$log" || true
  exit 1
fi

echo "Smoke test passed"
