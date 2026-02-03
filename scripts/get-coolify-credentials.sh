#!/bin/bash

# Coolify API credentials
COOLIFY_URL="https://app.databridge360.com/api/v1"
API_TOKEN="1|M1l82CwkKtlfMA7qK0AEIlmEatDPpdosWQMGUjjqd7066ac2"
CF_CLIENT_ID="fe38098610100d8080944b9de808750e.access"
CF_CLIENT_SECRET="73e28d089fc883306da5f966799ddd689cbf41c9f9b50ab9740c7489c7ab5938"

echo "🔍 Fetching Coolify resources..."

# Get all resources (databases)
RESOURCES=$(curl -s "${COOLIFY_URL}/resources" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "CF-Access-Client-Id: ${CF_CLIENT_ID}" \
  -H "CF-Access-Client-Secret: ${CF_CLIENT_SECRET}")

echo "📦 Resources:"
echo "${RESOURCES}" | jq -r '.[] | select(.type | contains("database")) | "\(.name) (\(.type)) - ID: \(.id)"'

echo ""
echo "💾 PostgreSQL Databases:"
echo "${RESOURCES}" | jq -r '.[] | select(.type | contains("postgresql")) | "Name: \(.name), ID: \(.id)"'

echo ""
echo "🔴 Redis Databases:"
echo "${RESOURCES}" | jq -r '.[] | select(.type | contains("redis")) | "Name: \(.name), ID: \(.id)"'

echo ""
echo "ℹ️  Om connectie details te krijgen voor een specifieke database:"
echo "curl '${COOLIFY_URL}/databases/{DATABASE_ID}' \\"
echo "  -H 'Authorization: Bearer ${API_TOKEN}' \\"
echo "  -H 'CF-Access-Client-Id: ${CF_CLIENT_ID}' \\"
echo "  -H 'CF-Access-Client-Secret: ${CF_CLIENT_SECRET}' | jq '.'"
