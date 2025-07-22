#!/bin/bash
# Run Docker MCP Agent Web Interface
# Usage: ./run-web.sh

echo "🌐 Starting Docker MCP Agent Web Interface..."
echo "💡 Make sure to set your OPENAI_API_KEY environment variable"
echo ""

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY environment variable is not set!"
    echo "   Set it with: export OPENAI_API_KEY='your-key-here'"
    echo ""
    read -p "Press Enter to continue anyway (or Ctrl+C to exit)"
fi

echo "🚀 Starting web server on http://localhost:3000"
echo "📝 Enhanced reasoning mode enabled by default"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

docker run --rm -it \
  -p 3000:3000 \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e OPENAI_BASE_URL="$OPENAI_BASE_URL" \
  -e OPENAI_MODEL="$OPENAI_MODEL" \
  docker-mcp --web
