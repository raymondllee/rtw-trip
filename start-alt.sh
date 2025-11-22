#!/bin/bash

# Alternate Startup Script for Travel Concierge
# Usage: ./start-alt.sh [OFFSET]
# Example: ./start-alt.sh 1000  (Runs on ports 6173, 6001, 9000)

OFFSET=${1:-0}

# Base ports
BASE_FRONTEND_PORT=5173
BASE_FLASK_PORT=5001
BASE_ADK_PORT=8000

# Calculated ports
FRONTEND_PORT=$((BASE_FRONTEND_PORT + OFFSET))
FLASK_PORT=$((BASE_FLASK_PORT + OFFSET))
ADK_PORT=$((BASE_ADK_PORT + OFFSET))

echo "🚀 Starting Travel Concierge on Alternate Ports (Offset: $OFFSET)..."
echo "================================================================"
echo "🌐 Frontend: http://localhost:$FRONTEND_PORT"
echo "🐍 Flask API: http://localhost:$FLASK_PORT"
echo "🤖 ADK API: http://localhost:$ADK_PORT"
echo "================================================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill processes on a specific port
kill_port() {
    if port_in_use $1; then
        echo "🔧 Killing existing process on port $1..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# Check dependencies
if ! command_exists "node" || ! command_exists "python3" || ! command_exists "poetry"; then
    echo "❌ Missing dependencies (node, python3, or poetry)."
    exit 1
fi

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Create logs directory
mkdir -p logs

# Kill existing processes on these specific ports
kill_port $FRONTEND_PORT
kill_port $FLASK_PORT
kill_port $ADK_PORT

# Start Flask API Server
echo ""
echo "🐍 Starting Flask API Server (Port $FLASK_PORT)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"
export PORT=$FLASK_PORT
export ADK_API_PORT=$ADK_PORT
poetry run python api_server.py > "$SCRIPT_DIR/logs/flask-api-$OFFSET.log" 2>&1 &
FLASK_PID=$!
echo "✅ Flask API Server started (PID: $FLASK_PID)"

# Start ADK API Server
echo ""
echo "🤖 Starting ADK API Server (Port $ADK_PORT)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"
# Assuming adk supports --port based on start.sh usage
.venv/bin/adk api_server travel_concierge --port $ADK_PORT > "$SCRIPT_DIR/logs/adk-api-$OFFSET.log" 2>&1 &
ADK_PID=$!
echo "✅ ADK API Server started (PID: $ADK_PID)"

# Start Frontend Server
echo ""
echo "🌐 Starting Frontend Server (Port $FRONTEND_PORT)..."
cd "$SCRIPT_DIR"
export VITE_PORT=$FRONTEND_PORT
export VITE_API_TARGET="http://localhost:$FLASK_PORT"
npm run dev -- --port $FRONTEND_PORT --host > "$SCRIPT_DIR/logs/frontend-$OFFSET.log" 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend Server started (PID: $FRONTEND_PID)"

# Wait for servers
echo ""
echo "⏳ Waiting for servers to start..."
sleep 5

# Check status
echo ""
echo "🔍 Checking server status..."

if curl -s http://localhost:$FLASK_PORT/health >/dev/null 2>&1; then
    echo "✅ Flask API Server is running"
else
    echo "⚠️ Flask API Server might not be running (check logs/flask-api-$OFFSET.log)"
fi

if curl -s http://localhost:$ADK_PORT/docs >/dev/null 2>&1; then
    echo "✅ ADK API Server is running"
else
    echo "⚠️ ADK API Server might not be running (check logs/adk-api-$OFFSET.log)"
fi

if curl -s http://localhost:$FRONTEND_PORT/ >/dev/null 2>&1; then
    echo "✅ Frontend Server is running"
else
    echo "⚠️ Frontend Server might not be running (check logs/frontend-$OFFSET.log)"
fi

echo ""
echo "🎉 Done! Access the app at http://localhost:$FRONTEND_PORT"
echo "To stop: kill $FLASK_PID $ADK_PID $FRONTEND_PID"
