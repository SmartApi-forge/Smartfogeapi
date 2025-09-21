#!/bin/bash

# This script runs during building the sandbox template
# and sets up the API generation and validation environment

echo "Setting up API generation sandbox environment..."

# Change to user directory
cd /home/user

# CLI parsing and help handler
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Available commands:"
    echo "  validate_openapi_spec <file>  Validate OpenAPI specification file"
    echo "  compile_typescript            Run TypeScript compilation"
    echo "  lint_code                     Run ESLint code linting"
    echo "  run_tests                     Run Jest test suite"
    echo "  validate_api_project          Run full validation suite"
    echo ""
    echo "Options:"
    echo "  -h, --help                    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 validate_openapi_spec api-spec.json"
    echo "  $0 compile_typescript"
    echo "  $0 --help"
}

# Handle command line arguments
if [ "$#" -gt 0 ]; then
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        validate_openapi_spec)
            shift
            validate_openapi_spec "$@"
            exit $?
            ;;
        compile_typescript)
            shift
            compile_typescript "$@"
            exit $?
            ;;
        lint_code)
            shift
            lint_code "$@"
            exit $?
            ;;
        run_tests)
            shift
            run_tests "$@"
            exit $?
            ;;
        validate_api_project)
            shift
            validate_api_project "$@"
            exit $?
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
fi

# CLI-friendly wrapper functions (shims)
validate_openapi_spec() {
    validate_openapi "$@"
    return $?
}

compile_typescript() {
    run_typescript_compilation "$@"
    return $?
}

lint_code() {
    run_linting "$@"
    return $?
}

run_tests() {
    run_test_suite "$@"
    return $?
}

# Function to validate OpenAPI specifications
validate_openapi() {
    local spec_file="$1"
    echo "Validating OpenAPI specification: $spec_file"
    
    if [ -f "$spec_file" ]; then
        # Use swagger-parser for validation
        npx swagger-parser validate "$spec_file"
        local parser_exit_code=$?
        
        # Use Spectral for additional linting
        spectral lint "$spec_file"
        local spectral_exit_code=$?
        
        if [ $parser_exit_code -eq 0 ] && [ $spectral_exit_code -eq 0 ]; then
            echo "✅ OpenAPI specification is valid"
            return 0
        else
            echo "❌ OpenAPI specification validation failed"
            return 1
        fi
    else
        echo "⚠️  OpenAPI specification file not found: $spec_file"
        return 1
    fi
}

# Function to run TypeScript compilation
run_typescript_compilation() {
    echo "Running TypeScript compilation..."
    
    if [ -f "tsconfig.json" ]; then
        npx tsc --noEmit
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "✅ TypeScript compilation successful"
            return 0
        else
            echo "❌ TypeScript compilation failed"
            return 1
        fi
    else
        echo "⚠️  tsconfig.json not found, skipping TypeScript compilation"
        return 0
    fi
}

# Function to run ESLint
run_linting() {
    echo "Running ESLint..."
    
    if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.yml" ]; then
        npx eslint src/ --ext .ts,.js
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "✅ Linting passed"
            return 0
        else
            echo "❌ Linting failed"
            return 1
        fi
    else
        echo "⚠️  ESLint configuration not found, skipping linting"
        return 0
    fi
}

# Function to run tests
run_test_suite() {
    echo "Running tests..."
    
    if [ -f "jest.config.json" ] || [ -f "jest.config.js" ]; then
        npm test
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "✅ Tests passed"
            return 0
        else
            echo "❌ Tests failed"
            return 1
        fi
    else
        echo "⚠️  Jest configuration not found, skipping tests"
        return 0
    fi
}

# Main validation function
validate_api_project() {
    echo "🚀 Starting API project validation..."
    
    local validation_passed=true
    
    # Check for OpenAPI spec files
    local spec_found=false
    for spec_file in api-spec.json openapi.json swagger.json api.yaml openapi.yaml swagger.yaml; do
        if [ -f "$spec_file" ]; then
            spec_found=true
            validate_openapi "$spec_file"
            if [ $? -ne 0 ]; then
                validation_passed=false
            fi
            break
        fi
    done
    
    # If no spec file was found, mark validation as failed
    if [ "$spec_found" = false ]; then
        echo "❌ No OpenAPI specification file found"
        validation_passed=false
    fi
    
    # Run TypeScript compilation
    run_typescript_compilation
    if [ $? -ne 0 ]; then
        validation_passed=false
    fi
    
    # Run linting
    run_linting
    if [ $? -ne 0 ]; then
        validation_passed=false
    fi
    
    # Run tests
    run_test_suite
    if [ $? -ne 0 ]; then
        validation_passed=false
    fi
    
    if [ "$validation_passed" = true ]; then
        echo "🎉 All validations passed! API project is ready."
        return 0
    else
        echo "💥 Some validations failed. Please check the output above."
        return 1
    fi
}

# Function to detect listening ports
detect_listening_ports() {
    echo "Detecting listening ports..."
    local ports=()
    
    # Method 1: netstat
    if command -v netstat >/dev/null 2>&1; then
        local netstat_ports=$(netstat -tln 2>/dev/null | grep LISTEN | grep -o ':[0-9]*' | cut -d: -f2 | sort -u)
        if [ -n "$netstat_ports" ]; then
            ports+=($(echo "$netstat_ports"))
        fi
    fi
    
    # Method 2: ss
    if command -v ss >/dev/null 2>&1; then
        local ss_ports=$(ss -tln 2>/dev/null | grep LISTEN | grep -o ':[0-9]*' | cut -d: -f2 | sort -u)
        if [ -n "$ss_ports" ]; then
            ports+=($(echo "$ss_ports"))
        fi
    fi
    
    # Method 3: lsof
    if command -v lsof >/dev/null 2>&1; then
        local lsof_ports=$(lsof -i -P -n 2>/dev/null | grep LISTEN | grep -o ':[0-9]*' | cut -d: -f2 | sort -u)
        if [ -n "$lsof_ports" ]; then
            ports+=($(echo "$lsof_ports"))
        fi
    fi
    
    # Remove duplicates and return
    printf '%s\n' "${ports[@]}" | sort -u
}

# Function to test API endpoint
test_api_endpoint() {
    local port="$1"
    local endpoint="${2:-/health}"
    local method="${3:-GET}"
    
    echo "Testing ${method} http://localhost:${port}${endpoint}"
    
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -m 10 -X "$method" "http://localhost:${port}${endpoint}" 2>/dev/null)
        local exit_code=$?
        
        if [ $exit_code -eq 0 ] && [ -n "$response" ]; then
            echo "✅ Endpoint responded: ${response:0:100}"
            return 0
        else
            echo "❌ Endpoint failed (curl exit code: $exit_code)"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        local response=$(wget -q -O- --timeout=10 "http://localhost:${port}${endpoint}" 2>/dev/null)
        local exit_code=$?
        
        if [ $exit_code -eq 0 ] && [ -n "$response" ]; then
            echo "✅ Endpoint responded: ${response:0:100}"
            return 0
        else
            echo "❌ Endpoint failed (wget exit code: $exit_code)"
            return 1
        fi
    else
        echo "⚠️  No HTTP client available (curl/wget)"
        return 1
    fi
}

# Function to wait for server startup
wait_for_server() {
    local port="${1:-3000}"
    local max_attempts="${2:-30}"
    local attempt=1
    
    echo "Waiting for server on port $port (max $max_attempts attempts)..."
    
    while [ $attempt -le $max_attempts ]; do
        if command -v nc >/dev/null 2>&1; then
            if nc -z localhost "$port" 2>/dev/null; then
                echo "✅ Server is listening on port $port (attempt $attempt)"
                return 0
            fi
        elif command -v netstat >/dev/null 2>&1; then
            if netstat -tln 2>/dev/null | grep -q ":$port "; then
                echo "✅ Server is listening on port $port (attempt $attempt)"
                return 0
            fi
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts - waiting for port $port..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Server failed to start on port $port after $max_attempts attempts"
    return 1
}

# Create a simple health check endpoint for testing
echo "Creating health check script..."
cat > health-check.js << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString(), port: PORT }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'API Server is running', timestamp: new Date().toISOString(), port: PORT }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Health check server running on http://${HOST}:${PORT}`);
  console.log(`Health endpoint: http://${HOST}:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
EOF

# Export functions for use in interactive mode
export -f validate_openapi
export -f validate_openapi_spec
export -f run_typescript_compilation
export -f compile_typescript
export -f run_linting
export -f lint_code
export -f run_test_suite
export -f run_tests
export -f validate_api_project

# Only run the announce and tail block when executed directly (not when sourced)
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    # Make the validation function available for external calls
    echo "API validation environment is ready!"
    echo "Available commands:"
    echo "  - validate_openapi <spec-file>  : Validate OpenAPI specification"
    echo "  - validate_openapi_spec <file>  : CLI-friendly OpenAPI validation"
    echo "  - run_typescript_compilation    : Run TypeScript compilation"
    echo "  - compile_typescript            : CLI-friendly TypeScript compilation"
    echo "  - run_linting                   : Run ESLint"
    echo "  - lint_code                     : CLI-friendly code linting"
    echo "  - run_test_suite                : Run Jest tests"
    echo "  - run_tests                     : CLI-friendly test runner"
    echo "  - validate_api_project          : Run full validation suite"
    echo "  - node health-check.js          : Start health check server"
    
    # Keep the container running
    echo "Sandbox is ready for API development and testing!"
    tail -f /dev/null
fi