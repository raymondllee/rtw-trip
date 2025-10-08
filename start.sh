#!/bin/bash

# Railway startup script for RTW Trip application
# This script builds web config and starts both the ADK API server and the Flask API server

set -e

echo "🚀 Starting RTW Trip Application..."

# Build web configuration from environment variables
echo "🔧 Building web configuration..."
echo "📋 Environment check:"
echo "  FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID:-NOT SET}"
echo "  GOOGLE_MAPS_API_KEY: ${GOOGLE_MAPS_API_KEY:-NOT SET}"
echo "  RAILWAY_PUBLIC_DOMAIN: ${RAILWAY_PUBLIC_DOMAIN:-NOT SET}"

# Run the build script directly with node (npm run may not pass env vars)
node scripts/build-web-config.js

# Use the system Python (where pip3 installed packages), not Nix Python
PYTHON_BIN="/usr/bin/python3"

# Set Python path to include the travel-concierge module
export PYTHONPATH="/app/python/agents:${PYTHONPATH}"

# Start ADK API server in the background
echo "📡 Starting ADK API server on port 8000..."
cd /app/python/agents
$PYTHON_BIN -m google.adk.cli api_server travel-concierge --port 8000 --host 0.0.0.0 &
ADK_PID=$!
cd /app

# Give ADK server time to start
echo "⏳ Waiting for ADK server to initialize..."
sleep 10

# Check if ADK server is still running
if ! kill -0 $ADK_PID 2>/dev/null; then
    echo "❌ ADK server failed to start"
    exit 1
fi

echo "✅ ADK server started successfully (PID: $ADK_PID)"

# Start Flask API server
echo "🌐 Starting Flask API server on port ${PORT}..."
cd /app/python/agents/travel-concierge
exec $PYTHON_BIN -m gunicorn \
    --bind 0.0.0.0:${PORT} \
    --workers 2 \
    --timeout 300 \
    --access-logfile - \
    --error-logfile - \
    api_server:app
