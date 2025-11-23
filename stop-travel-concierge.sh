#!/bin/bash

# Travel Concierge Stop Script
# Stops all running travel concierge servers
# Usage: ./stop-travel-concierge.sh [--cleanup]

CLEANUP_ALL=false

# Parse arguments
if [[ "$1" == "--cleanup" ]] || [[ "$1" == "--all" ]]; then
    CLEANUP_ALL=true
fi

echo "🛑 Stopping Travel Concierge Application..."
echo "========================================="

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

# Function to kill all processes matching a pattern
kill_by_pattern() {
    local pattern=$1
    local service_name=$2
    
    echo "🔍 Searching for $service_name processes..."
    local pids=$(pgrep -f "$pattern")
    
    if [ -n "$pids" ]; then
        echo "🔧 Killing all $service_name processes..."
        echo "$pids" | xargs kill -9 2>/dev/null
        echo "✅ All $service_name processes stopped"
    else
        echo "ℹ️  No $service_name processes found"
    fi
}

if [ "$CLEANUP_ALL" = true ]; then
    echo ""
    echo "🧹 CLEANUP MODE: Killing ALL app instances..."
    echo "⚠️  This will kill all Vite, Flask API, and ADK API processes!"
    echo ""
    
    # Kill all matching processes by pattern
    kill_by_pattern "node.*vite" "Vite (Frontend)"
    kill_by_pattern "python.*api_server.py" "Flask API"
    kill_by_pattern "adk api_server travel_concierge" "ADK API"
    
    # Clean up PID files
    rm -f logs/*.pid 2>/dev/null
else
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
fi

# Clean up log files (optional)
if [ "$CLEANUP_ALL" = false ]; then
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
fi

echo ""
echo "🎉 All Travel Concierge services have been stopped!"
echo "💡 Run './start-travel-concierge.sh' to start again."