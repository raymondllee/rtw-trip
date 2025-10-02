#!/bin/bash

# Travel Concierge Stop Script
# Stops all running travel concierge servers

echo "🛑 Stopping Travel Concierge Application..."
echo "========================================"

# Function to kill processes on specific ports
kill_port() {
    if lsof -ti:$1 >/dev/null 2>&1; then
        echo "🔧 Stopping process on port $1..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null
        echo "✅ Port $1 cleared"
    else
        echo "ℹ️  No process found on port $1"
    fi
}

# Function to kill processes by PID from files
kill_pid_file() {
    local pid_file=$1
    local service_name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "🔧 Stopping $service_name (PID: $pid)..."
            kill $pid 2>/dev/null
            sleep 1
            if ps -p $pid > /dev/null 2>&1; then
                echo "⚠️  Force stopping $service_name..."
                kill -9 $pid 2>/dev/null
            fi
            echo "✅ $service_name stopped"
        else
            echo "ℹ️  $service_name process not running"
        fi
        rm -f "$pid_file"
    else
        echo "ℹ️  No PID file found for $service_name"
    fi
}

# Kill processes using saved PID files
echo ""
echo "📋 Stopping registered services..."

kill_pid_file "logs/flask.pid" "Flask API Server"
kill_pid_file "logs/adk.pid" "ADK API Server"
kill_pid_file "logs/frontend.pid" "Frontend Server"

# Also clear ports by force (backup method)
echo ""
echo "🧹 Cleaning up any remaining processes..."
kill_port 5173  # Frontend
kill_port 5001  # Flask API
kill_port 8000  # ADK API

# Clean up log files (optional)
echo ""
read -p "🗑️  Do you want to clean up log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "logs" ]; then
        rm -f logs/*.log
        rm -f logs/*.pid
        echo "✅ Log files cleaned up"
    else
        echo "ℹ️  No log directory found"
    fi
else
    echo "ℹ️  Log files preserved"
fi

echo ""
echo "🎉 All Travel Concierge services have been stopped!"
echo "💡 Run './start-travel-concierge.sh' to start again."