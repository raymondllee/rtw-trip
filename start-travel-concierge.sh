#!/bin/bash

# Travel Concierge Startup Script
# Starts all three required servers for the travel concierge application

echo "🚀 Starting Travel Concierge Application..."
echo "========================================="

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

# Kill existing processes on required ports
echo ""
echo "🧹 Cleaning up existing processes..."
kill_port 5173  # Frontend
kill_port 5001  # Flask API
kill_port 8000  # ADK API

# Start Flask API Server (Port 5001)
echo ""
echo "🐍 Starting Flask API Server (Port 5001)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"

# Start Flask API server in background using Poetry
poetry run python api_server.py > "$SCRIPT_DIR/logs/flask-api.log" 2>&1 &
FLASK_PID=$!
echo "✅ Flask API Server started (PID: $FLASK_PID)"

# Start ADK API Server (Port 8000)
echo ""
echo "🤖 Starting ADK API Server (Port 8000)..."
cd "$SCRIPT_DIR/python/agents/travel-concierge"

# Start ADK API server in background using direct path to Poetry's venv
.venv/bin/adk api_server travel_concierge > "$SCRIPT_DIR/logs/adk-api.log" 2>&1 &
ADK_PID=$!
echo "✅ ADK API Server started (PID: $ADK_PID)"

# Start Frontend Server (Port 5173)
echo ""
echo "🌐 Starting Frontend Server (Port 5173)..."
cd "$SCRIPT_DIR"
npm run serve > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
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
if curl -s http://localhost:5001/health >/dev/null 2>&1; then
    echo "✅ Flask API Server is running on http://localhost:5001"
else
    echo "❌ Flask API Server failed to start"
fi

# Check ADK API
if curl -s http://localhost:8000/docs >/dev/null 2>&1; then
    echo "✅ ADK API Server is running on http://localhost:8000"
else
    echo "❌ ADK API Server failed to start"
fi

# Check Frontend
if curl -s http://localhost:5173/web/ >/dev/null 2>&1; then
    echo "✅ Frontend Server is running on http://localhost:5173"
else
    echo "❌ Frontend Server failed to start"
fi

# Display server information
echo ""
echo "🎉 Travel Concierge is ready!"
echo "=============================="
echo "📱 Frontend:    http://localhost:5173/web/"
echo "🔧 API Backend: http://localhost:5001"
echo "🤖 ADK API:     http://localhost:8000/docs"
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