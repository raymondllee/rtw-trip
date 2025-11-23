#!/bin/bash

# Travel Concierge Startup Script
# Starts all three required servers for the travel concierge application
# Usage: ./start-travel-concierge.sh [--cleanup] [OFFSET]

CLEANUP=false
OFFSET=0

# Parse arguments
for arg in "$@"; do
    if [[ "$arg" == "--cleanup" ]]; then
        CLEANUP=true
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        OFFSET=$arg
    fi
done

# Base ports
BASE_FRONTEND_PORT=5173
BASE_FLASK_PORT=5001
BASE_ADK_PORT=8000

# Calculated ports
FRONTEND_PORT=$((BASE_FRONTEND_PORT + OFFSET))
FLASK_PORT=$((BASE_FLASK_PORT + OFFSET))
ADK_PORT=$((BASE_ADK_PORT + OFFSET))

echo "🚀 Starting Travel Concierge Application (Offset: $OFFSET)..."
echo "==========================================================="
echo "🌐 Frontend:    http://localhost:$FRONTEND_PORT"
echo "🗺️  Trip Map:   http://localhost:$FRONTEND_PORT/index.html"
echo "🧘 Wellness:    http://localhost:$FRONTEND_PORT/wellness-dashboard.html"
echo "🐍 Flask API:   http://localhost:$FLASK_PORT"
echo "🤖 ADK API:     http://localhost:$ADK_PORT"
echo "==========================================================="

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

# Check required dependencies
echo "📋 Checking dependencies..."

if ! command_exists "node"; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists "python3"; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

if ! command_exists "poetry"; then
    echo "❌ Poetry is not installed. Please install Poetry first."
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one from .env.example first."
    exit 1
fi

# Change to the script's directory first
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check if ADK is installed in poetry environment
if ! (cd python/agents/travel-concierge && poetry run which adk >/dev/null 2>&1); then
    echo "❌ ADK CLI is not installed. Please run 'cd python/agents/travel-concierge && poetry install' first."
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Run cleanup if requested
if [ "$CLEANUP" = true ]; then
    echo ""
    echo "🧹 Running cleanup..."
    ./stop-travel-concierge.sh --cleanup
    echo ""
    echo "✅ Cleanup complete, starting servers..."
    sleep 2
fi

# Kill existing processes on required ports
echo ""
echo "🧹 Cleaning up existing processes on target ports..."
kill_port $FRONTEND_PORT
kill_port $FLASK_PORT
kill_port $ADK_PORT

# Start Flask API Server
echo ""
echo "🐍 Starting Flask API Server (Port $FLASK_PORT)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"

# Export ports for Flask app to use
export PORT=$FLASK_PORT
export ADK_API_PORT=$ADK_PORT

# Start Flask API server in background using Poetry
poetry run python api_server.py > "$SCRIPT_DIR/logs/flask-api.log" 2>&1 &
FLASK_PID=$!
echo "✅ Flask API Server started (PID: $FLASK_PID)"

# Start ADK API Server
echo ""
echo "🤖 Starting ADK API Server (Port $ADK_PORT)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"

# Start ADK API server in background using direct path to Poetry's venv
.venv/bin/adk api_server travel_concierge --port $ADK_PORT > "$SCRIPT_DIR/logs/adk-api.log" 2>&1 &
ADK_PID=$!
echo "✅ ADK API Server started (PID: $ADK_PID)"

# Start Frontend Server
echo ""
echo "🌐 Starting Frontend Server (Port $FRONTEND_PORT)..."
cd "$SCRIPT_DIR"

# Export Vite vars
export VITE_PORT=$FRONTEND_PORT
export VITE_API_TARGET="http://localhost:$FLASK_PORT"

npm run dev -- --port $FRONTEND_PORT --host > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend Server started (PID: $FRONTEND_PID)"

# Wait for servers to start
echo ""
echo "⏳ Waiting for servers to start..."
sleep 5

# Check if servers are running
echo ""
echo "🔍 Checking server status..."

# Check Flask API
if curl -s http://localhost:$FLASK_PORT/health >/dev/null 2>&1; then
    echo "✅ Flask API Server is running on http://localhost:$FLASK_PORT"
else
    echo "❌ Flask API Server failed to start"
fi

# Check ADK API
if curl -s http://localhost:$ADK_PORT/docs >/dev/null 2>&1; then
    echo "✅ ADK API Server is running on http://localhost:$ADK_PORT"
else
    echo "❌ ADK API Server failed to start"
fi

# Check Frontend
if curl -s http://localhost:$FRONTEND_PORT/ >/dev/null 2>&1; then
    echo "✅ Frontend Server is running on http://localhost:$FRONTEND_PORT"
else
    echo "❌ Frontend Server failed to start"
fi

# Display server information
echo ""
echo "🎉 Travel Concierge is ready!"
echo "=============================="
echo "📱 Frontend:    http://localhost:$FRONTEND_PORT"
echo "🗺️  Trip Map:   http://localhost:$FRONTEND_PORT/index.html"
echo "🧘 Wellness:    http://localhost:$FRONTEND_PORT/wellness-dashboard.html"
echo "🔧 API Backend: http://localhost:$FLASK_PORT"
echo "🤖 ADK API:     http://localhost:$ADK_PORT/docs"
echo ""
echo "📝 Logs are available in the 'logs' directory:"
echo "   - Flask API:   logs/flask-api.log"
echo "   - ADK API:     logs/adk-api.log"
echo "   - Frontend:    logs/frontend.log"
echo ""
echo "🛑 To stop all servers, run: ./stop-travel-concierge.sh"
echo ""
echo "💡 Tip: The chat feature may require Google Cloud credentials"
echo "   Make sure your .env file is properly configured."

# Save PIDs for cleanup
echo $FLASK_PID > "$SCRIPT_DIR/logs/flask.pid"
echo $ADK_PID > "$SCRIPT_DIR/logs/adk.pid"
echo $FRONTEND_PID > "$SCRIPT_DIR/logs/frontend.pid"

echo "✨ All servers started successfully!"
