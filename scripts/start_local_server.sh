#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node src/Node.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "等待服务启动..."
for i in {1..30}; do
  for port in 3000 3001 3002 3003 3004 3005; do
    if curl -fsS "http://localhost:${port}/health" >/dev/null 2>&1; then
      echo "已打开: http://localhost:${port}"
      open "http://localhost:${port}" >/dev/null 2>&1 || true
      wait "$SERVER_PID"
      exit 0
    fi
  done
  sleep 0.3
done

echo "本地服务未就绪，请查看终端日志。"
wait "$SERVER_PID"
