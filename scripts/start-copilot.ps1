# Start Job Search Copilot locally and open the browser.
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed. Install from https://nodejs.org/" -ForegroundColor Red
  if ($Host.Name -eq "ConsoleHost") { Read-Host "Press Enter to close" }
  exit 1
}

if (-not (Test-Path ".env.local") -and -not (Test-Path ".env")) {
  Write-Host "Warning: no .env.local found. Copy .env.example and add your keys." -ForegroundColor Yellow
}

$port = 3000

if ((Test-Path ".next") -and -not (Test-Path ".next\BUILD_ID")) {
  Write-Host "Found an incomplete .next cache. Clearing it before startup..." -ForegroundColor Yellow
  Remove-Item -LiteralPath ".next" -Recurse -Force
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 5
    Write-Host "Job Search Copilot already appears to be running at http://localhost:$port" -ForegroundColor Green
    Start-Process "http://localhost:$port"
    if ($Host.Name -eq "ConsoleHost") { Read-Host "Press Enter to close" }
    exit 0
  } catch {
    Write-Host "Port $port is already occupied but is not responding." -ForegroundColor Red
    Write-Host "Stop PID $($listener.OwningProcess), then run this script again." -ForegroundColor Yellow
    if ($Host.Name -eq "ConsoleHost") { Read-Host "Press Enter to close" }
    exit 1
  }
}

$built = Test-Path ".next\BUILD_ID"
$mode = if ($built) { "production (npm start)" } else { "development (npm run dev)" }

Write-Host ""
Write-Host "Job Search Copilot" -ForegroundColor Cyan
Write-Host "  http://localhost:$port"
Write-Host "  Mode: $mode"
Write-Host ""
Write-Host "Close this window or press Ctrl+C to stop."
Write-Host ""

# Open browser after the server has time to start
Start-Job -ScriptBlock {
  param($p)
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
      $null = Invoke-WebRequest -Uri "http://localhost:$p" -UseBasicParsing -TimeoutSec 2
      Start-Process "http://localhost:$p"
      return
    } catch { }
  }
} -ArgumentList $port | Out-Null

if ($built) {
  npm run start
} else {
  npm run dev
}
