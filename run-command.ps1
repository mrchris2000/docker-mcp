# PowerShell script to run a single command
param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    [string]$ApiKey = $env:OPENAI_API_KEY,
    [string]$BaseUrl = "https://api.openai.com/v1",
    [string]$Model = "gpt-4"
)

if (-not $ApiKey) {
    Write-Host "Error: OPENAI_API_KEY environment variable not set or provided" -ForegroundColor Red
    Write-Host "Usage: .\run-command.ps1 -Command 'your command' -ApiKey 'your-api-key'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🐳 Building Docker image..." -ForegroundColor Blue
docker build -t docker-mcp . -q

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Running command: $Command" -ForegroundColor Green

docker run --rm `
    -e OPENAI_API_KEY=$ApiKey `
    -e OPENAI_BASE_URL=$BaseUrl `
    -e OPENAI_MODEL=$Model `
    docker-mcp $Command
