# PowerShell script to run the agent interactively
param(
    [string]$ApiKey = $env:OPENAI_API_KEY,
    [string]$BaseUrl = "https://api.openai.com/v1",
    [string]$Model = "gpt-4"
)

if (-not $ApiKey) {
    Write-Host "Error: OPENAI_API_KEY environment variable not set or provided" -ForegroundColor Red
    Write-Host "Usage: .\run-interactive.ps1 -ApiKey 'your-api-key'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🐳 Building Docker image..." -ForegroundColor Blue
docker build -t docker-mcp .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Starting interactive agent..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the container" -ForegroundColor Yellow

docker run --rm -it `
    -e OPENAI_API_KEY=$ApiKey `
    -e OPENAI_BASE_URL=$BaseUrl `
    -e OPENAI_MODEL=$Model `
    docker-mcp --interactive
