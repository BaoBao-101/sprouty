#!/bin/bash
# Diagnose the AI chat "Hệ thống đang bảo trì" / "lỗi kết nối" issue.
# Run from /opt/sprouty on the VPS, ideally right after sending a test
# message on the AI page so the relevant log lines are still recent.
cd "$(dirname "$0")/.."

echo "=== 1. Env vars ==="
grep -E 'AI_PROVIDER|GEMINI_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY' .env | sed -E 's/(API_KEY=.{6}).*/\1.../'
echo

echo "=== 2. Backend image/container status ==="
docker compose images backend
docker compose ps backend
echo

echo "=== 3. Health check ==="
curl -s https://sprouty.id.vn/api/v1/health
echo
echo

echo "=== 4. Recent backend logs (chat/gemini/error) ==="
docker compose logs --tail=150 backend | grep -i -A3 'chat\|gemini\|error'
