#!/bin/bash

# Script to run Prisma migrations on Coolify via Docker container
# Uses the Coolify Docker network to access databases

set -e

echo "🚀 Running Prisma migrations on Coolify..."

# Database credentials
DB_PASSWORD="A9HUDZdJWzpTTchdvktLmLA8VoqCo1mMPjpyuBNu1MDhHH8E3XEnLCzqCA0lHe3H"
DB_HOST="r00oss4cggks40c48c0kg8o8"
DATABASE_URL="postgres://postgres:${DB_PASSWORD}@${DB_HOST}:5432/postgres"

# Create temporary directory on server
echo "📁 Creating temporary directory..."
ssh Hetzner "mkdir -p /tmp/partyquiz-migration"

# Copy Prisma files to server
echo "📤 Copying Prisma schema and config..."
scp apps/web/prisma/schema.prisma Hetzner:/tmp/partyquiz-migration/
scp apps/web/prisma.config.ts Hetzner:/tmp/partyquiz-migration/
scp -r apps/web/prisma/migrations Hetzner:/tmp/partyquiz-migration/ 2>/dev/null || echo "No migrations folder yet"

# Run migrations in Docker container on Coolify network
echo "🔄 Running Prisma migrate deploy..."
ssh Hetzner << 'ENDSSH'
docker run --rm \
  --network coolify \
  -v /tmp/partyquiz-migration:/workspace \
  -w /workspace \
  -e DATABASE_URL="postgres://postgres:A9HUDZdJWzpTTchdvktLmLA8VoqCo1mMPjpyuBNu1MDhHH8E3XEnLCzqCA0lHe3H@r00oss4cggks40c48c0kg8o8:5432/postgres" \
  node:20-alpine sh -c '
    echo "Installing dependencies..."
    npm install prisma@7.3.0 dotenv tsx @prisma/client@7.3.0 &>/dev/null
    
    echo "Running migrations..."
    npx prisma migrate deploy
    
    echo "✅ Migrations completed!"
  '
ENDSSH

# Cleanup
echo "🧹 Cleaning up..."
ssh Hetzner "rm -rf /tmp/partyquiz-migration"

echo "✅ Migration completed successfully!"
