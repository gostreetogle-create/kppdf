<#
.SYNOPSIS
  KPPDF - One-command launcher for Windows
.DESCRIPTION
  1. Kills processes on specified ports (default: 3000 backend, 4200 frontend)
  2. Starts Docker MongoDB (if available)
  3. Starts backend (Express + MongoDB) in background
  4. Starts frontend (Angular) in a separate terminal window
  5. Opens browser at http://localhost:4200
.PARAMETER Ports
  Ports to free. Default: @(3000, 4200).
.PARAMETER SkipDocker
  If set, skip Docker start (uses existing MongoDB at localhost:27017).
.EXAMPLE
  .\start.ps1
  Launch with Docker MongoDB + cleanup ports 3000 and 4200.

  .\start.ps1 -SkipDocker
  Launch without Docker (expects MongoDB at localhost:27017).

  .\start.ps1 -Ports @(3000, 4200, 9229)
  Clean three ports + Docker MongoDB.
#>

param(
  [int[]]$Ports = @(3000, 4200),
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Continue'

# ──────────────────────────────────────────────────────────────
# Helper: ensure npm dependencies are installed
# ──────────────────────────────────────────────────────────────
function Ensure-Dependencies {
  param([string]$Dir, [string]$Label)

  $nodeModules = Join-Path $Dir "node_modules"

  if (-not (Test-Path $nodeModules)) {
    Write-Host "  >> ${Label}: node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $Dir
    try {
      $null = npm install 2> $null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "     ${Label} dependencies installed." -ForegroundColor Green
      } else {
        Write-Host "     WARNING: npm install for ${Label} had issues." -ForegroundColor Red
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "  >> ${Label}: node_modules found." -ForegroundColor Green
  }
}

# ──────────────────────────────────────────────────────────────
# Helper: kill process on a port
# ──────────────────────────────────────────────────────────────
function Stop-ProcessesOnPort {
  param([int]$Port)

  Write-Host "  >> Checking port $Port..."

  $pids = @()

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    }
  } catch {}

  if ($pids.Count -eq 0) {
    $netstat = netstat -ano | Select-String ":$Port"
    if ($netstat) {
      $pids = $netstat | ForEach-Object {
        ($_.ToString() -split '\s+')[-1]
      } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ } | Select-Object -Unique
    }
  }

  if ($pids.Count -eq 0) {
    Write-Host "     Port $Port is free." -ForegroundColor Green
    return
  }

  foreach ($procId in $pids) {
    if ($procId -eq $PID) { continue }
    try {
      $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "     Stopping $($proc.ProcessName) (PID $procId) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "     PID $procId stopped." -ForegroundColor Green
        Start-Sleep -Milliseconds 300
      }
    } catch {
      Write-Host "     Could not stop PID ${procId}: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

# ──────────────────────────────────────────────────────────────
# Helper: wait for HTTP endpoint to respond 200
# ──────────────────────────────────────────────────────────────
function Wait-ForEndpoint {
  param(
    [string]$Url,
    [string]$Label,
    [int]$TimeoutSeconds = 60
  )

  Write-Host "     Waiting for $Label at $Url ..." -NoNewline
  $elapsed = 0
  while ($elapsed -lt $TimeoutSeconds) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
      if ($r.StatusCode -eq 200) {
        Write-Host " ready!" -ForegroundColor Green
        return $true
      }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "." -NoNewline
  }
  Write-Host " timeout ($TimeoutSeconds s)" -ForegroundColor Red
  return $false
}

# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
$root = $PSScriptRoot
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'

Write-Host ""
Write-Host "========== KPPDF Launcher ==========" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Check dependencies ──
Write-Host "[0/5] Checking dependencies..." -ForegroundColor Gray
Ensure-Dependencies -Dir $root -Label "Frontend"
Ensure-Dependencies -Dir $backendDir -Label "Backend"
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# ── Step 1: Free ports ──
Write-Host "[1/5] Freeing ports..." -ForegroundColor Gray
foreach ($port in $Ports) {
  Stop-ProcessesOnPort -Port $port
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# ── Step 2: Start Docker MongoDB ──
Write-Host "[2/5] Database..." -ForegroundColor Gray

if (-not $SkipDocker) {
  Write-Host "  >> Starting MongoDB in Docker..."
  Push-Location $root
  $null = docker compose up -d 2> $null
  if ($?) {
    Write-Host "     MongoDB container is up on port 27017." -ForegroundColor Green
  } else {
    Write-Host "     Docker not available. Ensure MongoDB is running locally." -ForegroundColor Yellow
  }
  Pop-Location
} else {
  Write-Host "  >> Skipping Docker. Expecting MongoDB at localhost:27017." -ForegroundColor Yellow
}
Write-Host ""

# ── Step 3: Start backend ──
Write-Host "[3/5] Starting backend (Express + MongoDB)..." -ForegroundColor Gray

Start-Process -WindowStyle Hidden -FilePath "powershell" -ArgumentList @(
  '-NoExit'
  '-Command'
  "Set-Location '$backendDir'; Write-Host '=== KPPDF Backend (http://localhost:3000) ===' -ForegroundColor Cyan; npm run dev"
)
Write-Host "  >> npm run dev (background)" -ForegroundColor Green

Start-Sleep -Seconds 4

# ── Step 4: Start frontend ──
Write-Host ""
Write-Host "[4/5] Starting frontend (Angular)..." -ForegroundColor Gray

Start-Process -WindowStyle Normal -FilePath "powershell" -ArgumentList @(
  '-NoExit'
  '-Command'
  "Set-Location '$frontendDir'; Write-Host '=== KPPDF Frontend (http://localhost:4200) ===' -ForegroundColor Cyan; npm start"
)
Write-Host "  >> npm start (new window)" -ForegroundColor Green

# ── Wait for readiness and show summary ──
Write-Host ""
Write-Host "====== Waiting for services to start... ======" -ForegroundColor Cyan

$backendReady = Wait-ForEndpoint -Url "http://localhost:3000/health" -Label "Backend" -TimeoutSeconds 90

Write-Host ""
if ($backendReady) {
  Write-Host "====== KPPDF is running! ======" -ForegroundColor Cyan
  Write-Host "  Frontend: http://localhost:4200" -ForegroundColor White
  Write-Host "  Backend:  http://localhost:3000" -ForegroundColor White
  Write-Host "  Health:   http://localhost:3000/health" -ForegroundColor White
  Write-Host "==================================" -ForegroundColor Cyan

  Start-Sleep -Seconds 3
  Start-Process "http://localhost:4200"
} else {
  Write-Host "WARNING: Backend did not respond within timeout." -ForegroundColor Red
  Write-Host "Check the backend terminal window for errors." -ForegroundColor Yellow
  Write-Host "Then open http://localhost:4200 manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To stop: close the 'KPPDF Frontend' terminal window or stop processes manually." -ForegroundColor Gray
Write-Host ""
