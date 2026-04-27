# OFD Scheduler - Windows Service & Task Scheduler installer
# Run this script once as Administrator to:
#   1. Install PM2 as a Windows service (auto-starts app on reboot)
#   2. Register Windows Task Scheduler tasks for Monday reminders
#
# Prerequisites (install before running):
#   - Node.js 20+ from https://nodejs.org/
#   - Python 3.x from https://python.org/  (required for better-sqlite3 native build)
#   - Visual Studio Build Tools from https://visualstudio.microsoft.com/downloads/
#     (select "Desktop development with C++" workload)
#
# Usage (from an elevated PowerShell prompt):
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#   .\install-service.ps1

#Requires -RunAsAdministrator

param(
    [int]$Port = 3000,
    [string]$RemindTime = "08:00",  # Monday reminder time (24h format)
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=====================================" -ForegroundColor Yellow
Write-Host "  OFD Scheduler - Service Installer  " -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host ""

# ── Step 1: Verify prerequisites ─────────────────────────────────────────────
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Install from https://nodejs.org/ and re-run."
    exit 1
}
$nodeVersion = node --version
Write-Host "  Node.js $nodeVersion - OK" -ForegroundColor Green

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Warning "  Python not found. better-sqlite3 requires Python for compilation."
    Write-Warning "  Install from https://python.org/ if npm install fails."
} else {
    Write-Host "  Python $(python --version) - OK" -ForegroundColor Green
}

# ── Step 2: Verify .env.local ─────────────────────────────────────────────────
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.local.example") {
        Copy-Item ".env.local.example" ".env.local"
        Write-Warning ".env.local created from template. EDIT IT NOW before continuing."
        Write-Warning "  Required: MAILGUN_API_KEY, MAILGUN_DOMAIN, NOTIFY_CRON_SECRET"
        Write-Warning "  Required: BASE_URL, NOTIFY_CRON_SECRET"
        Invoke-Item ".env.local"
        Read-Host "Press Enter after editing .env.local to continue"
    } else {
        Write-Error ".env.local not found. Create it from .env.local.example."
        exit 1
    }
}

# Load NOTIFY_CRON_SECRET from .env.local
$cronSecret = ""
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^NOTIFY_CRON_SECRET=(.+)") {
        $cronSecret = $Matches[1].Trim()
    }
}
if (-not $cronSecret -or $cronSecret -eq "replace-with-random-string") {
    Write-Error "NOTIFY_CRON_SECRET is not set in .env.local. Set a random secret string."
    exit 1
}

$BaseUrl = "http://localhost:$Port"

# ── Step 3: Install dependencies and build ────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed."; exit 1 }

Write-Host "Building application..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "npm build failed."; exit 1 }

New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null

# ── Step 4: Install PM2 and register Windows service ─────────────────────────
Write-Host ""
Write-Host "Installing PM2..." -ForegroundColor Cyan
npm install -g pm2
npm install -g pm2-windows-startup

Write-Host "Starting app with PM2..." -ForegroundColor Cyan
pm2 start ecosystem.config.js
pm2 save

Write-Host "Registering PM2 as Windows service..." -ForegroundColor Cyan
pm2-startup install

Write-Host "  PM2 service registered. App will auto-start on reboot." -ForegroundColor Green

# ── Step 5: Register Windows Task Scheduler tasks ────────────────────────────
Write-Host ""
Write-Host "Setting up Windows Task Scheduler tasks..." -ForegroundColor Cyan

# Task 1: Monday morning reminder
$reminderTaskName = "OFD Monday Reminder"
$reminderScript = @"
Invoke-WebRequest -Uri '$BaseUrl/api/cron/remind' -Method POST -Headers @{'x-cron-secret'='$cronSecret'} -UseBasicParsing | Out-Null
"@

# Remove existing task if present
Unregister-ScheduledTask -TaskName $reminderTaskName -Confirm:$false -ErrorAction SilentlyContinue

$reminderAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -Command `"$reminderScript`""

$reminderTrigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday `
    -At $RemindTime

$taskSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $reminderTaskName `
    -Action $reminderAction `
    -Trigger $reminderTrigger `
    -Settings $taskSettings `
    -RunLevel Highest `
    -Description "Sends Monday morning email reminders to OFD members who have not completed their checks." `
    | Out-Null

Write-Host "  Registered: '$reminderTaskName' (every Monday at $RemindTime)" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL:     $BaseUrl" -ForegroundColor White
Write-Host "  PM2 status:  pm2 status" -ForegroundColor White
Write-Host "  PM2 logs:    pm2 logs ofd-scheduler" -ForegroundColor White
Write-Host "  Task Sched:  taskschd.msc" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open $BaseUrl in a browser to verify the app is running."
Write-Host "  2. Test the reminder: Start-ScheduledTask '$reminderTaskName'"
