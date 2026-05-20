#!/usr/bin/env bash

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8766}"
URL="http://localhost:${PORT}/index.html"

# Check if server is already running
if ! curl -fsS --max-time 2 "${URL}" >/dev/null 2>&1; then
  echo "Starting Tool Atelier server on port ${PORT}..."
  
  # Start server in background with nohup
  nohup python3 -m http.server "${PORT}" --directory "${BASE_DIR}" >/tmp/tool_atelier_http.log 2>&1 &
  SERVER_PID=$!
  # disown the process (suppress any errors on macOS)
  disown $SERVER_PID 2>/dev/null || true
  
  # Wait for server to start (max 10 seconds)
  for i in {1..50}; do
    if curl -fsS --max-time 1 "${URL}" >/dev/null 2>&1; then
      echo "✓ Server started successfully (PID: $SERVER_PID)"
      break
    fi
    if [ $i -eq 50 ]; then
      echo "⚠ Warning: Server may not have started yet, but continuing..."
      sleep 1
      break
    fi
    sleep 0.2
  done
else
  echo "✓ Server already running"
fi

# Open URL in browser
OS_TYPE="$(uname)"

if [ "${OS_TYPE}" = "Darwin" ]; then
  # macOS
  if [ -d "/Applications/Google Chrome.app" ]; then
    echo "Opening in Google Chrome..."
    open -a "Google Chrome" "${URL}"
  elif [ -d "/Applications/Chromium.app" ]; then
    echo "Opening in Chromium..."
    open -a "Chromium" "${URL}"
  else
    echo "✗ Chrome/Chromium が見つかりません。"
    echo "次のURLを手動で開いてください: ${URL}"
    exit 1
  fi
elif command -v google-chrome >/dev/null 2>&1; then
  # Linux - google-chrome
  echo "Opening in Google Chrome..."
  google-chrome "${URL}" >/dev/null 2>&1 &
elif command -v google-chrome-stable >/dev/null 2>&1; then
  # Linux - google-chrome-stable
  echo "Opening in Google Chrome..."
  google-chrome-stable "${URL}" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  # Linux - chromium-browser
  echo "Opening in Chromium..."
  chromium-browser "${URL}" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  # Linux - chromium
  echo "Opening in Chromium..."
  chromium "${URL}" >/dev/null 2>&1 &
else
  echo "✗ Chrome/Chromium が見つかりません。"
  echo "次のURLを手動で開いてください: ${URL}"
  exit 1
fi

echo ""
echo "✓ Opened: ${URL}"
echo "  Log file: /tmp/tool_atelier_http.log"
