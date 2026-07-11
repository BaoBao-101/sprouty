#!/bin/bash
# Force-rebuild the backend clean (no cache), confirm it's actually running
# the latest code, then walk through the AI chat "Hệ thống đang bảo trì" /
# "lỗi kết nối" diagnosis. Run from /opt/sprouty on the VPS:
#   ./docker/diagnose-ai.sh
set -e
cd "$(dirname "$0")/.."

echo "=== 0. Clean rebuild of backend (no cache) ==="
docker compose build --no-cache backend
docker compose up -d backend

cid=$(docker compose ps -q backend)
echo -n "Waiting for backend to become healthy..."
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then echo " healthy"; break; fi
  echo -n "."
  sleep 2
done
echo

echo "=== 1. Env vars ==="
grep -E 'AI_PROVIDER|GEMINI_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY' .env | sed -E 's/(API_KEY=.{6}).*/\1.../'
echo

echo "=== 2. Backend image/container status ==="
docker compose images backend
docker compose ps backend
echo

echo "=== 3. Confirm the RUNNING container has the latest chat.js (logging fix) ==="
echo "Expect: fastify.log.error({ err }, 'Chat error');"
docker compose exec -T backend grep -A1 'Chat error' src/routes/chat.js
echo

echo "=== 4. Health check ==="
curl -s https://sprouty.id.vn/api/v1/health
echo
echo

echo ">>> Rebuild xong và đã chạy code mới nhất."
echo ">>> Bây giờ mở https://sprouty.id.vn/pages/ai.html, gửi thử 1 tin nhắn chat,"
echo ">>> rồi quay lại đây và nhấn Enter để xem log lỗi."
read -p "Nhấn Enter sau khi đã gửi thử tin nhắn chat... " _

echo
echo "=== 5. Recent backend logs (chat/gemini/error) ==="
docker compose logs --tail=150 backend | grep -i -A5 'chat\|gemini\|error'
