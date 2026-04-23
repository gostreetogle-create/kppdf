param(
  [int[]]$Ports = @(3000, 4200),
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'

function Stop-ProcessesOnPort {
  param([int]$Port)

  Write-Host ">> Checking port $Port..."
  $pids = @()

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    }
  } catch {
    # Fallback path below
  }

  if (-not $pids -or $pids.Count -eq 0) {
    $netstat = netstat -ano | Select-String ":$Port"
    if ($netstat) {
      $pids = $netstat | ForEach-Object {
        ($_.ToString() -split '\s+')[-1]
      } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ } | Select-Object -Unique
    }
  }

  if (-not $pids -or $pids.Count -eq 0) {
    Write-Host "   Port $Port is free."
    return
  }

  foreach ($procId in $pids) {
    if ($procId -eq $PID) { continue }
    try {
      Write-Host "   Stopping PID $procId on port $Port..."
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "   PID $procId stopped."
    } catch {
      Write-Host "   Could not stop PID ${procId}: $($_.Exception.Message)"
    }
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'

Write-Host "== Local start: cleanup + services ==" -ForegroundColor Cyan

foreach ($port in $Ports) {
  Stop-ProcessesOnPort -Port $port
}

if (-not $SkipDocker) {
  Write-Host ">> Starting docker services (mongodb)..."
  Push-Location $root
  try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "   Docker Compose failed (exit $LASTEXITCODE). MongoDB will not be available on port 27017." -ForegroundColor Red
      Write-Host "   Start Docker Desktop and run this script again, or use: .\start.cmd -SkipDocker if MongoDB runs elsewhere." -ForegroundColor Yellow
      exit $LASTEXITCODE
    }
    Write-Host "   Docker services are up."
  } finally {
    Pop-Location
  }
}

Write-Host ">> Starting backend..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "cd '$backendDir'; npm run dev"
)

Start-Sleep -Seconds 2

Write-Host ">> Starting frontend..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "cd '$frontendDir'; npm start"
)

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000"
Write-Host "Frontend: http://localhost:4200"
