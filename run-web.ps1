# Run Docker MCP Agent Web Interface
# Usage: .\run-web.ps1

Write-Host "🌐 Starting Docker MCP Agent Web Interface..." -ForegroundColor Cyan
Write-Host "💡 Make sure to set your OPENAI_API_KEY environment variable" -ForegroundColor Yellow
Write-Host ""

$apiKey = $env:OPENAI_API_KEY
if (-not $apiKey) {
    Write-Host "❌ OPENAI_API_KEY environment variable is not set!" -ForegroundColor Red
    Write-Host "   Set it with: `$env:OPENAI_API_KEY='your-key-here'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue anyway (or Ctrl+C to exit)"
}

Write-Host "🚀 Starting web server on http://localhost:3000" -ForegroundColor Green
Write-Host "📝 Enhanced reasoning mode enabled by default" -ForegroundColor Blue
Write-Host "⏹️  Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

docker run --rm -it `
  -p 3000:3000 `
  -e OPENAI_API_KEY="$env:OPENAI_API_KEY" `
  -e OPENAI_BASE_URL="$env:OPENAI_BASE_URL" `
  -e OPENAI_MODEL="$env:OPENAI_MODEL" `
  docker-mcp --web
