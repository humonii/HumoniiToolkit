#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8765}"
URL="http://localhost:${PORT}/demo.html?mode=candidate_scrfd"

if ! curl -fsS "http://localhost:${PORT}/demo.html" >/dev/null 2>&1; then
  echo "Starting local server on port ${PORT}..."
  nohup python3 -m http.server "${PORT}" --directory "${BASE_DIR}" >/tmp/face_mask_http.log 2>&1 &
fi

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome "${URL}" >/dev/null 2>&1 &
elif command -v google-chrome-stable >/dev/null 2>&1; then
  google-chrome-stable "${URL}" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser "${URL}" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium "${URL}" >/dev/null 2>&1 &
else
  echo "Chrome/Chromium が見つかりません。"
  echo "次のURLを手動で開いてください: ${URL}"
  exit 1
fi

echo "Opened: ${URL}"
