#!/bin/bash

# Railway startup script for RTW Trip application
# This script starts both the ADK API server and the Flask API server

set -e

echo "🚀 Starting RTW Trip Application..."

# Use the system Python (where pip3 installed packages), not Nix Python
PYTHON_BIN="/usr/bin/python3"

# Debug: Show Python and pip paths
echo "🔍 Using Python: $PYTHON_BIN"
echo "🔍 Python version: $($PYTHON_BIN --version)"
echo "🔍 Pip path: $(which pip3)"
echo "🔍 Python sys.path:"
$PYTHON_BIN -c "import sys; print('\n'.join(sys.path))"
echo "🔍 Checking installed packages..."
pip3 list | grep -i adk || echo "⚠️ ADK not found in pip list"
echo "🔍 Looking for google_adk installation location..."
pip3 show google-adk | grep Location || echo "⚠️ Could not find google-adk location"
echo "🔍 Listing contents of /usr/local/lib/python3.12/dist-packages:"
ls -la /usr/local/lib/python3.12/dist-packages/ | grep -i google || echo "⚠️ No google packages found"
echo "🔍 Trying to import google_adk directly:"
$PYTHON_BIN -c "import google_adk; print(google_adk.__file__)" || echo "⚠️ Cannot import google_adk"
echo "🔍 Checking if google-adk has cli module:"
$PYTHON_BIN -c "from google_adk import cli; print(cli.__file__)" || echo "⚠️ Cannot import google_adk.cli"

# Set Python path to include the travel-concierge module
export PYTHONPATH="/app/python/agents:${PYTHONPATH}"

# Change to the correct directory
cd /app

# Start ADK API server in the background
echo "📡 Starting ADK API server on port 8000..."
$PYTHON_BIN -m google_adk.cli api_server travel_concierge --port 8000 --host 0.0.0.0 &
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
exec $PYTHON_BIN -m gunicorn \
    --bind 0.0.0.0:${PORT} \
    --workers 2 \
    --timeout 300 \
    --access-logfile - \
    --error-logfile - \
    api_server:app
