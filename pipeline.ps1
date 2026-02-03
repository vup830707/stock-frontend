$ErrorActionPreference = "Stop"

function Run-Step($name, $cmd) {
  Write-Host "`n$name" -ForegroundColor Yellow
  & $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $name (exit code: $LASTEXITCODE)"
  }
}

Write-Host "===============================" -ForegroundColor Cyan
Write-Host " Frontend Local CI/CD Pipeline " -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

Run-Step "[CI] npm ci" { npm ci }
Run-Step "[CI] npm run build" { npm run build }
Run-Step "[CI] docker build -t stock-frontend:local ." { docker build -t stock-frontend:local . }
Run-Step "[CD] docker compose up -d" { docker compose -f .\docker-compose.yaml up -d }

Write-Host "`n[CD] Service status:" -ForegroundColor Green
docker compose -f .\docker-compose.yaml ps

Write-Host "Frontend CI/CD finished successfully." -ForegroundColor Green
