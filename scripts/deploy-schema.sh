#!/bin/bash

# Deploy Prisma Schema to Coolify Database
# This script runs migrations directly on the Hetzner server

set -e

echo "📦 Deploying Prisma schema to Coolify database..."

# Database credentials
POSTGRES_CONTAINER="r00oss4cggks40c48c0kg8o8"
POSTGRES_PASSWORD="A9HUDZdJWzpTTchdvktLmLA8VoqCo1mMPjpyuBNu1MDhHH8E3XEnLCzqCA0lHe3H"

echo ""
echo "Step 1: Copying Prisma schema to server..."
scp -r prisma Hetzner:/tmp/partyquiz-prisma/

echo ""
echo "Step 2: Installing dependencies on server..."
ssh Hetzner "cd /tmp/partyquiz-prisma && npm install prisma --save-dev"

echo ""
echo "Step 3: Running Prisma migrations..."
ssh Hetzner "cd /tmp/partyquiz-prisma && DATABASE_URL='postgres://postgres:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER}:5432/postgres' npx prisma migrate deploy"

echo ""
echo "Step 4: Cleaning up..."
ssh Hetzner "rm -rf /tmp/partyquiz-prisma"

echo ""
echo "✅ Database schema deployed successfully!"
