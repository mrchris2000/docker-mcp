#!/bin/bash
# Bash script to run the agent interactively

API_KEY=${1:-$OPENAI_API_KEY}
BASE_URL=${2:-"https://api.openai.com/v1"}
MODEL=${3:-"gpt-4"}

if [ -z "$API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable not set or provided"
    echo "Usage: ./run-interactive.sh [api-key] [base-url] [model]"
    exit 1
fi

echo "🐳 Building Docker image..."
docker build -t docker-mcp .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "🚀 Starting interactive agent..."
echo "Press Ctrl+C to stop the container"

docker run --rm -it \
    -e OPENAI_API_KEY="$API_KEY" \
    -e OPENAI_BASE_URL="$BASE_URL" \
    -e OPENAI_MODEL="$MODEL" \
    docker-mcp --interactive
