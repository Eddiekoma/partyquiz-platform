#!/bin/bash

# SSH Tunnel voor Coolify Databases
# Dit script zet SSH tunnels op naar de Coolify databases op Hetzner

echo "🔐 Setting up SSH tunnels to Coolify databases..."

# SSH Host from ~/.ssh/config
SSH_HOST="Hetzner"

# Database container IPs (internal Docker network IPs on Hetzner)
# These are more reliable than container names for SSH tunneling
# Get with: docker inspect <container> --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
POSTGRES_IP="10.0.1.11"
REDIS_IP="10.0.1.14"

# Fallback to localhost with exposed port if internal IPs don't work
# PostgreSQL proxy exposes port 54320

echo ""
echo "Setting up tunnels via SSH host: ${SSH_HOST}"
echo "  PostgreSQL: localhost:5432 -> ${POSTGRES_IP}:5432"
echo "  Redis:      localhost:6379 -> ${REDIS_IP}:6379"
echo ""

# Check if tunnels already exist
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 5432 is already in use. Killing existing process..."
    lsof -ti:5432 | xargs kill -9 2>/dev/null
    sleep 1
fi

if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 6379 is already in use. Killing existing process..."
    lsof -ti:6379 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Start SSH tunnels in background using SSH config host
ssh -f -N -L 5432:${POSTGRES_IP}:5432 ${SSH_HOST}
ssh -f -N -L 6379:${REDIS_IP}:6379 ${SSH_HOST}

# Verify tunnels
sleep 2

if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ PostgreSQL tunnel active on localhost:5432"
else
    echo "❌ Failed to create PostgreSQL tunnel"
    exit 1
fi

if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Redis tunnel active on localhost:6379"
else
    echo "❌ Failed to create Redis tunnel"
    exit 1
fi

echo ""
echo "🎉 SSH tunnels are ready!"
echo ""
echo "To use these tunnels, update your .env files to use:"
echo "  DATABASE_URL=postgres://postgres:A9HUDZdJWzpTTchdvktLmLA8VoqCo1mMPjpyuBNu1MDhHH8E3XEnLCzqCA0lHe3H@localhost:5432/postgres"
echo "  REDIS_URL=redis://default:rukO6osWHCq3KxfKcfPraKG4mV7vqFvjctZ0Hqi71uWdzXh5g5B6G83GyCBYUBTr@localhost:6379/0"
echo ""
echo "To close tunnels later, run: ./scripts/close-ssh-tunnel.sh"
