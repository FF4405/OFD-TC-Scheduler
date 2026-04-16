# OFD Scheduler - PowerShell startup script
# Usage:
#   .\start.ps1          # Production mode (requires 'npm run build' first)
#   .\start.ps1 dev      # Development mode with hot reload
#   .\start.ps1 build    # Build only

param(
    [string]$Mode = "prod"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Verify Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH. Download from https://nodejs.org/"
    exit 1
}

# Verify .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Warning ".env.local not found. Copying from .env.local.example..."
    if (Test-Path ".env.local.example") {
        Copy-Item ".env.local.example" ".env.local"
        Write-Warning "Please edit .env.local and add your Mailgun, FirstDue, and other credentials."
    } else {
        Write-Error ".env.local.example not found. Cannot continue."
        exit 1
    }
}

# Ensure data directory exists
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null

switch ($Mode.ToLower()) {
    "dev" {
        Write-Host "Starting OFD Scheduler in DEVELOPMENT mode..." -ForegroundColor Cyan
        npm run dev
    }
    "build" {
        Write-Host "Building OFD Scheduler..." -ForegroundColor Cyan
        npm run build
    }
    default {
        Write-Host "Starting OFD Scheduler in PRODUCTION mode on port $($env:PORT ?? 3000)..." -ForegroundColor Green
        npm run build
        npm start
    }
}
