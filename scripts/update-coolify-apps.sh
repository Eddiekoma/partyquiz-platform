#!/bin/bash

# Update Coolify Applications Configuration

set -e

COOLIFY_URL="https://app.databridge360.com/api/v1"
API_TOKEN="1|M1l82CwkKtlfMA7qK0AEIlmEatDPpdosWQMGUjjqd7066ac2"
CF_CLIENT_ID="fe38098610100d8080944b9de808750e.access"
CF_CLIENT_SECRET="73e28d089fc883306da5f966799ddd689cbf41c9f9b50ab9740c7489c7ab5938"

# Application UUIDs
WEB_UUID="zww0kg4cok8skwsowow40s8s"
WS_UUID="sgwcccwkwgg4s08o080gk4ow"

echo "🔧 Updating PartyQuiz applications in Coolify..."

# Update Web App
echo ""
echo "📱 Updating partyquiz-web..."
curl -X PATCH "${COOLIFY_URL}/applications/${WEB_UUID}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "CF-Access-Client-Id: ${CF_CLIENT_ID}" \
  -H "CF-Access-Client-Secret: ${CF_CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "dockerfile_location": "/apps/web/Dockerfile",
    "base_directory": "/",
    "health_check_enabled": true,
    "health_check_path": "/api/healthz",
    "health_check_port": "3000",
    "health_check_interval": 30,
    "health_check_timeout": 10,
    "health_check_retries": 3
  }' | jq '.'

echo ""
echo "📡 Updating partyquiz-ws..."
curl -X PATCH "${COOLIFY_URL}/applications/${WS_UUID}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "CF-Access-Client-Id: ${CF_CLIENT_ID}" \
  -H "CF-Access-Client-Secret: ${CF_CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "dockerfile_location": "/apps/ws/Dockerfile",
    "base_directory": "/",
    "health_check_enabled": true,
    "health_check_path": "/healthz",
    "health_check_port": "8080",
    "health_check_interval": 30,
    "health_check_timeout": 10,
    "health_check_retries": 3
  }' | jq '.'

echo ""
echo "✅ Applications updated!"
echo ""
echo "Next steps:"
echo "1. In Cloudflare DNS, add CNAME records:"
echo "   - partyquiz.databridge360.com -> YOUR_CLOUDFLARE_TUNNEL"
echo "   - ws.partyquiz.databridge360.com -> YOUR_CLOUDFLARE_TUNNEL"
echo ""
echo "2. Trigger new deployment in Coolify UI"
echo "3. Monitor build logs for errors"
