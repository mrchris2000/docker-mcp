#!/bin/sh
set -e

# Get the test name from environment variable or use default
TEST_NAME="${TEST_NAME:-DemoTest}"

# Base URL template
BASE_URL="devops-test:https://loop.platform-staging1.us-east.containers.appdomain.cloud/test/record?projectId=1300&branch=Demo&token=eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIyYWVkYmY0Ny0yN2EwLTQyZmUtOTFjOS1mZGI5ZDUzODc5YWUifQ.eyJpYXQiOjE3NTkzMTM3NjYsImp0aSI6ImY1YjI3NTJmLTM5YzktNDQzNC1hNjgyLTBlYjBmN2QyNWRmZCIsImlzcyI6Imh0dHBzOi8vbG9vcC5wbGF0Zm9ybS1zdGFnaW5nMS51cy1lYXN0LmNvbnRhaW5lcnMuYXBwZG9tYWluLmNsb3VkL2F1dGgvcmVhbG1zL2Rldm9wcy1hdXRvbWF0aW9uIiwiYXVkIjoiaHR0cHM6Ly9sb29wLnBsYXRmb3JtLXN0YWdpbmcxLnVzLWVhc3QuY29udGFpbmVycy5hcHBkb21haW4uY2xvdWQvYXV0aC9yZWFsbXMvZGV2b3BzLWF1dG9tYXRpb24iLCJzdWIiOiJkMjhiZmIwNS04NTY5LTQwYTMtYTc0Zi03OGI0ZDAzMDBkYWYiLCJ0eXAiOiJPZmZsaW5lIiwiYXpwIjoidGVzdHNlcnZlciIsInNpZCI6ImI5YzgzMTUzLWZlMTAtNGY1Ny05NDU4LWIzMTFhZjNjOGFjZiIsInNjb3BlIjoicm9sZXMgb2ZmbGluZV9hY2Nlc3MgcHJvZmlsZSB3ZWItb3JpZ2lucyBzZXJ2aWNlX2FjY291bnQgYmFzaWMgZW1haWwgYWNyIn0.TIF_iR1GRijwUUcs1X8FWpF9tNqG0JF3pkPVgcqGgal9vtE6-7Z6nXnLddROwEN92L1gdqrI7b3o6PKoaDi6Ig&ticket=Ad904c48e-5eee-4ce5-9123-e2fba64785b4&name=echoLogicPayments%2FDemoTest.dtx.yaml&repo=325c8e9f-9d7b-11f0-b40c-7a4d422f1c92&componentId=c543ea3a8cdd54c6b7fdb5cebf493326ebfbc335d058e66918c7ecce6d83bd30&mode=UI&browser=firefox"

# Replace DemoTest with the specified test name in the URL
DEVOPS_TEST_URL=$(echo "$BASE_URL" | sed "s/DemoTest/$TEST_NAME/g")

# Create logs directory for devops-test-runtime
mkdir -p /app/logs
mkdir -p /app/.cache
mkdir -p /app/.local
mkdir -p /tmp/webdriver
mkdir -p /app/.cache/webdriver

# Set up writable directories for WebDriver downloads and cache
export HOME=/app
export XDG_CACHE_HOME=/app/.cache
export TMPDIR=/tmp
export WEBDRIVER_CACHE_DIR=/app/.cache/webdriver

# Ensure directories are writable
chmod -R 777 /app/logs /app/.cache /app/.local /tmp/webdriver 2>/dev/null || true

# Start Xvfb (X Virtual Frame Buffer) for headless browser testing
echo "Starting Xvfb for headless browser support..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2
echo "Xvfb started (PID: $XVFB_PID)"

# Set up environment for headless Chrome
export DISPLAY=:99
export CHROME_BIN=/usr/bin/chromium
export CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"
export CHROMEDRIVER_PATH=/usr/bin/chromedriver

# WebDriver manager settings
export WDM_LOCAL=1

# Set INGRESS_DOMAIN for devops-test-runtime
export INGRESS_DOMAIN="${INGRESS_DOMAIN:-loop.platform-staging1.us-east.containers.appdomain.cloud}"

# Set default MCP configuration if not provided
export DEVOPS_TEST_MCP_PROMPT_PATH="${DEVOPS_TEST_MCP_PROMPT_PATH:-/app/devops-test-prompt.txt}"
export DEVOPS_TEST_MCP_PROGRAM="${DEVOPS_TEST_MCP_PROGRAM:-/usr/bin/tail -f /dev/null}"

# Create default prompt file if it doesn't exist
if [ ! -f "$DEVOPS_TEST_MCP_PROMPT_PATH" ]; then
    echo "Default DevOps Test MCP prompt" > "$DEVOPS_TEST_MCP_PROMPT_PATH"
fi

# Verify browser and driver setup
echo "=== Browser Setup Verification ==="
echo "Checking Chromium:"
which chromium && chromium --version 2>&1 | head -1 || echo "Chromium not found"
echo "Checking ChromeDriver:"
which chromedriver && chromedriver --version 2>&1 | head -1 || echo "ChromeDriver not found"quit
echo "Checking Firefox:"
which firefox && firefox --version 2>&1 | head -1 || echo "Firefox not found"
echo "Checking GeckoDriver:"
which geckodriver && geckodriver --version 2>&1 | head -1 || echo "GeckoDriver not found"
echo "DISPLAY: $DISPLAY"
echo "CHROME_BIN: $CHROME_BIN"
echo "CHROMEDRIVER_PATH: $CHROMEDRIVER_PATH"
echo "Testing Xvfb display:"
DISPLAY=:99 xdpyinfo >/dev/null 2>&1 && echo "✓ Xvfb display working" || echo "✗ Xvfb display not accessible"
echo "================================="
echo ""

# Start the devops-test-runtime cph command in the background (provides MCP server on port 6278)
echo "Starting devops-test-runtime with test name: $TEST_NAME"
cd /app
# Ensure webdriver cache is writable
chmod -R 777 /app/.cache/webdriver /app/logs 2>/dev/null || true
chmod -R 777 ~/.cache/webdriver 2>/dev/null || true
# If strace is available, run the runtime under strace to capture file access attempts
if command -v strace >/dev/null 2>&1; then
    echo "strace found — starting runtime under strace to capture file ops (/app/logs/strace.log)"
    strace -f -o /app/logs/strace.log -e trace=open,openat,access,stat,mkdir,write /opt/hcl/devops-test/devops-test-runtime cph --url "$DEVOPS_TEST_URL" > /app/logs/devops-test-runtime.log 2>&1 &
else
    /opt/hcl/devops-test/devops-test-runtime cph --url "$DEVOPS_TEST_URL" > /app/logs/devops-test-runtime.log 2>&1 &
fi
RUNTIME_PID=$!
echo "Started devops-test-runtime (PID: $RUNTIME_PID)"

# Wait for the MCP server to be available (port 6278)
echo "Waiting for MCP server to start on port 6278..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    # Check if process is still running
    if ! kill -0 $RUNTIME_PID 2>/dev/null; then
        echo "❌ devops-test-runtime process died! Check logs:"
        if [ -f /app/logs/devops-test-runtime.log ]; then
            echo "=== Runtime Log ==="
            cat /app/logs/devops-test-runtime.log
        else
            echo "Runtime log file not found"
        fi
        echo ""
        echo "=== File Access Attempts (last 50 lines) ==="
        if [ -f /app/logs/strace.log ]; then
            tail -50 /app/logs/strace.log | grep -E "(EACCES|ENOENT|EPERM|mkdir|openat)" || echo "No permission errors found"
        else
            echo "Strace log file not found"
        fi
        break
    fi
    
    # Check if port is open
    if nc -z 127.0.0.1 6278 2>/dev/null; then
        echo "✓ MCP server is ready on port 6278"
        break
    fi
    
    # Also try localhost
    if nc -z localhost 6278 2>/dev/null; then
        echo "✓ MCP server is ready on localhost:6278"
        break
    fi
    
    echo "  Waiting... ($i/15)"
    sleep 2
done

# Debug: Show what's listening
echo "Ports currently listening:"
netstat -tuln 2>/dev/null | grep LISTEN || ss -tuln 2>/dev/null | grep LISTEN || echo "Could not check listening ports"

# Start the main application with any passed arguments
exec node dist/agent.js "$@"
