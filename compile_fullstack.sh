#!/bin/bash

# Full-Stack Development Server Helper Script
# Supports: Next.js, React, Vue, Angular, FastAPI, and more
# This script provides utility functions for starting and managing preview servers

echo "Full-Stack Development Environment Ready!"

# Function to detect framework from package.json or other indicators
detect_framework() {
    local dir="${1:-.}"
    
    # Check for Next.js
    if [ -f "$dir/next.config.js" ] || [ -f "$dir/next.config.mjs" ] || [ -f "$dir/next.config.ts" ]; then
        echo "nextjs"
        return 0
    fi
    
    # Check package.json for framework indicators
    if [ -f "$dir/package.json" ]; then
        local pkg_content=$(cat "$dir/package.json")
        
        # Check for Next.js in dependencies
        if echo "$pkg_content" | grep -q '"next"'; then
            echo "nextjs"
            return 0
        fi
        
        # Check for Vite
        if echo "$pkg_content" | grep -q '"vite"'; then
            # Check if it's Vue or React
            if echo "$pkg_content" | grep -q '"vue"'; then
                echo "vue"
            else
                echo "react-vite"
            fi
            return 0
        fi
        
        # Check for Create React App
        if echo "$pkg_content" | grep -q '"react-scripts"'; then
            echo "react-cra"
            return 0
        fi
        
        # Check for Angular
        if echo "$pkg_content" | grep -q '"@angular/core"'; then
            echo "angular"
            return 0
        fi
        
        # Check for Vue CLI
        if echo "$pkg_content" | grep -q '"@vue/cli"'; then
            echo "vue"
            return 0
        fi
        
        # Check for Express
        if echo "$pkg_content" | grep -q '"express"'; then
            echo "express"
            return 0
        fi
    fi
    
    # Check for Python frameworks
    if [ -f "$dir/requirements.txt" ] || [ -f "$dir/pyproject.toml" ]; then
        # Check for FastAPI
        if [ -f "$dir/main.py" ]; then
            if grep -q "FastAPI\|from fastapi" "$dir/main.py" 2>/dev/null; then
                echo "fastapi"
                return 0
            fi
        fi
        
        # Check for Flask
        if grep -q "Flask\|from flask" "$dir"/*.py 2>/dev/null; then
            echo "flask"
            return 0
        fi
        
        echo "python"
        return 0
    fi
    
    echo "unknown"
    return 1
}

# Function to get default port for framework
get_default_port() {
    local framework="$1"
    
    case "$framework" in
        nextjs|react-cra|express)
            echo "3000"
            ;;
        react-vite|vue)
            echo "5173"
            ;;
        angular)
            echo "4200"
            ;;
        fastapi)
            echo "8000"
            ;;
        flask)
            echo "5000"
            ;;
        *)
            echo "3000"
            ;;
    esac
}

# Function to get start command for framework
get_start_command() {
    local framework="$1"
    local dir="${2:-.}"
    
    case "$framework" in
        nextjs)
            # Check if turbopack is available
            if command -v next >/dev/null 2>&1; then
                echo "npx next dev --turbopack --hostname 0.0.0.0"
            else
                echo "npm run dev"
            fi
            ;;
        react-vite|vue)
            echo "npm run dev -- --host 0.0.0.0"
            ;;
        react-cra)
            echo "HOST=0.0.0.0 npm start"
            ;;
        angular)
            echo "ng serve --host 0.0.0.0"
            ;;
        express)
            # Check for start script in package.json
            if [ -f "$dir/package.json" ]; then
                if grep -q '"start":' "$dir/package.json"; then
                    echo "npm start"
                else
                    echo "node index.js"
                fi
            else
                echo "node index.js"
            fi
            ;;
        fastapi)
            # Check for main.py or app.py
            if [ -f "$dir/main.py" ]; then
                echo "uvicorn main:app --host 0.0.0.0 --reload"
            elif [ -f "$dir/app.py" ]; then
                echo "uvicorn app:app --host 0.0.0.0 --reload"
            else
                echo "uvicorn main:app --host 0.0.0.0 --reload"
            fi
            ;;
        flask)
            echo "FLASK_APP=app.py flask run --host=0.0.0.0"
            ;;
        *)
            echo "npm start"
            ;;
    esac
}

# Function to check if port is listening
is_port_listening() {
    local port="$1"
    
    # Try netcat first
    if command -v nc >/dev/null 2>&1; then
        nc -z localhost "$port" 2>/dev/null
        return $?
    fi
    
    # Try netstat
    if command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    
    # Try ss
    if command -v ss >/dev/null 2>&1; then
        ss -tln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    
    # Try lsof
    if command -v lsof >/dev/null 2>&1; then
        lsof -i ":$port" >/dev/null 2>&1
        return $?
    fi
    
    return 1
}

# Function to wait for server to be ready
wait_for_server() {
    local port="${1:-3000}"
    local max_attempts="${2:-60}"
    local endpoint="${3:-/}"
    local attempt=1
    
    echo "⏳ Waiting for server on port $port (max $max_attempts attempts)..."
    
    while [ $attempt -le $max_attempts ]; do
        # First check if port is listening
        if is_port_listening "$port"; then
            # Then try to make an HTTP request
            if command -v curl >/dev/null 2>&1; then
                local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${endpoint}" 2>/dev/null)
                if [ "$response" != "000" ] && [ -n "$response" ]; then
                    echo "✅ Server is ready on port $port (HTTP $response) - attempt $attempt"
                    return 0
                fi
            else
                # If curl is not available, just check if port is listening
                echo "✅ Server is listening on port $port - attempt $attempt"
                return 0
            fi
        fi
        
        # Progress indicator
        if (( attempt % 10 == 0 )); then
            echo "⏳ Still waiting... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "❌ Server failed to start on port $port after $max_attempts attempts"
    return 1
}

# Function to ping server continuously (background task)
ping_server() {
    local port="${1:-3000}"
    local endpoint="${2:-/}"
    
    echo "🔍 Starting server health monitor on port $port..."
    
    counter=0
    while true; do
        if command -v curl >/dev/null 2>&1; then
            response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${endpoint}" 2>/dev/null)
        else
            # Fallback: just check if port is listening
            if is_port_listening "$port"; then
                response="200"
            else
                response="000"
            fi
        fi
        
        if [ "$response" = "200" ]; then
            let counter++
            if (( counter % 30 == 0 )); then
                echo "✅ Server is healthy (checked ${counter} times)"
            fi
        else
            echo "⚠️  Server not responding on port $port (HTTP $response)"
        fi
        
        sleep 2
    done
}

# Function to start development server
start_dev_server() {
    local dir="${1:-.}"
    local port="${2}"
    
    cd "$dir" || exit 1
    
    # Detect framework
    echo "🔍 Detecting framework..."
    local framework=$(detect_framework "$dir")
    echo "📦 Detected framework: $framework"
    
    # Get default port if not provided
    if [ -z "$port" ]; then
        port=$(get_default_port "$framework")
    fi
    echo "🚀 Using port: $port"
    
    # Get start command
    local start_cmd=$(get_start_command "$framework" "$dir")
    echo "▶️  Start command: $start_cmd"
    
    # Export environment variables
    export HOST=0.0.0.0
    export PORT=$port
    
    # Start the server
    echo "🚀 Starting development server..."
    eval "$start_cmd"
}

# Function to start server in background with health monitoring
start_server_background() {
    local dir="${1:-.}"
    local port="${2}"
    local log_file="${3:-/tmp/dev-server.log}"
    
    cd "$dir" || exit 1
    
    # Detect framework
    local framework=$(detect_framework "$dir")
    echo "📦 Detected framework: $framework"
    
    # Get default port if not provided
    if [ -z "$port" ]; then
        port=$(get_default_port "$framework")
    fi
    
    # Get start command
    local start_cmd=$(get_start_command "$framework" "$dir")
    
    # Export environment variables
    export HOST=0.0.0.0
    export PORT=$port
    
    # Start server in background
    echo "🚀 Starting server in background on port $port..."
    echo "📝 Logs: $log_file"
    
    nohup bash -c "$start_cmd" > "$log_file" 2>&1 &
    local server_pid=$!
    echo $server_pid > /tmp/dev-server.pid
    
    echo "✅ Server started with PID: $server_pid"
    
    # Wait for server to be ready
    # Next.js 15 + Tailwind v4 can take 5-10 minutes for first build, so wait longer
    if wait_for_server "$port" 600; then
        echo "✅ Server is ready and accepting connections!"
        return 0
    else
        echo "❌ Server failed to start. Check logs: $log_file"
        tail -50 "$log_file"
        return 1
    fi
}

# Function to stop background server
stop_server() {
    if [ -f /tmp/dev-server.pid ]; then
        local pid=$(cat /tmp/dev-server.pid)
        echo "🛑 Stopping server (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        rm /tmp/dev-server.pid
        echo "✅ Server stopped"
    else
        echo "⚠️  No running server found"
    fi
}

# Function to get server logs
show_logs() {
    local log_file="${1:-/tmp/dev-server.log}"
    local lines="${2:-50}"
    
    if [ -f "$log_file" ]; then
        echo "📝 Last $lines lines of server logs:"
        tail -n "$lines" "$log_file"
    else
        echo "⚠️  Log file not found: $log_file"
    fi
}

# Function to install dependencies
install_dependencies() {
    local dir="${1:-.}"
    
    cd "$dir" || exit 1
    
    echo "📦 Installing dependencies..."
    
    # Check for Node.js project
    if [ -f "package.json" ]; then
        # Detect package manager
        if [ -f "pnpm-lock.yaml" ]; then
            echo "Using pnpm..."
            pnpm install
        elif [ -f "yarn.lock" ]; then
            echo "Using yarn..."
            yarn install
        else
            echo "Using npm..."
            npm install
        fi
        return $?
    fi
    
    # Check for Python project
    if [ -f "requirements.txt" ]; then
        echo "Installing Python dependencies..."
        pip3 install -r requirements.txt
        return $?
    fi
    
    if [ -f "pyproject.toml" ]; then
        echo "Installing Python dependencies with poetry..."
        poetry install
        return $?
    fi
    
    echo "⚠️  No dependency file found"
    return 1
}

# Export functions for use in other scripts
export -f detect_framework
export -f get_default_port
export -f get_start_command
export -f is_port_listening
export -f wait_for_server
export -f ping_server
export -f start_dev_server
export -f start_server_background
export -f stop_server
export -f show_logs
export -f install_dependencies

# Help message
show_help() {
    echo "Full-Stack Development Server Helper"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  detect [dir]                  Detect framework in directory"
    echo "  install [dir]                 Install dependencies"
    echo "  start [dir] [port]            Start development server (foreground)"
    echo "  start-bg [dir] [port]         Start development server (background)"
    echo "  stop                          Stop background server"
    echo "  logs [lines]                  Show server logs"
    echo "  wait [port] [attempts]        Wait for server to be ready"
    echo "  ping [port]                   Monitor server health"
    echo ""
    echo "Examples:"
    echo "  $0 detect /home/user/repo"
    echo "  $0 install /home/user/repo"
    echo "  $0 start-bg /home/user/repo 3000"
    echo "  $0 wait 3000 60"
    echo "  $0 logs 100"
    echo "  $0 stop"
}

# Command line interface
if [ "$#" -gt 0 ]; then
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        detect)
            detect_framework "${2:-.}"
            exit $?
            ;;
        install)
            install_dependencies "${2:-.}"
            exit $?
            ;;
        start)
            start_dev_server "${2:-.}" "$3"
            exit $?
            ;;
        start-bg)
            start_server_background "${2:-.}" "$3" "$4"
            exit $?
            ;;
        stop)
            stop_server
            exit $?
            ;;
        logs)
            show_logs "/tmp/dev-server.log" "${2:-50}"
            exit $?
            ;;
        wait)
            wait_for_server "${2:-3000}" "${3:-60}"
            exit $?
            ;;
        ping)
            ping_server "${2:-3000}" "${3:-/}"
            exit $?
            ;;
        *)
            echo "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
fi

echo "✅ Full-stack development environment ready!"
echo "Run '$0 --help' for usage information"

