#!/bin/bash

# Railway startup script for RTW Trip application
# This script starts both the ADK API server and the Flask API server

set -e

echo "🚀 Starting RTW Trip Application..."

# Set Python path to include the travel-concierge module
export PYTHONPATH="/app/python/agents:${PYTHONPATH}"

# Change to the correct directory
cd /app

# Start ADK API server in the background
echo "📡 Starting ADK API server on port 8000..."
python3 -m google_adk.cli api_server travel_concierge --port 8000 --host 0.0.0.0 &
ADK_PID=$!

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
exec gunicorn \
    --bind 0.0.0.0:${PORT} \
    --workers 2 \
    --timeout 300 \
    --access-logfile - \
    --error-logfile - \
    api_server:app
