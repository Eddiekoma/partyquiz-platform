#!/bin/bash

# Close SSH tunnels voor Coolify databases

echo "🔒 Closing SSH tunnels..."

if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
    echo "Closing PostgreSQL tunnel (port 5432)..."
    lsof -ti:5432 | xargs kill -9 2>/dev/null
    echo "✅ PostgreSQL tunnel closed"
else
    echo "ℹ️  No PostgreSQL tunnel found on port 5432"
fi

if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null ; then
    echo "Closing Redis tunnel (port 6379)..."
    lsof -ti:6379 | xargs kill -9 2>/dev/null
    echo "✅ Redis tunnel closed"
else
    echo "ℹ️  No Redis tunnel found on port 6379"
fi

echo ""
echo "✅ All tunnels closed"
