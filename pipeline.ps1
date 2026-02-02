$ErrorActionPreference = "Stop"

Write-Host "===============================" -ForegroundColor Cyan
Write-Host " Frontend Local CI/CD Pipeline " -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# --------
# CI
# --------
Write-Host "`n[CI] Install dependencies (npm ci)" -ForegroundColor Yellow
npm ci

Write-Host "`n[CI] Build React app (npm run build)" -ForegroundColor Yellow
npm run build

# --------
# Build Image
# --------
Write-Host "`n[CI] Build Docker image (stock-frontend:local)" -ForegroundColor Yellow
docker build -t stock-frontend:local .

# --------
# CD
# --------
Write-Host "`n[CD] Deploy with docker compose" -ForegroundColor Green
docker compose -f .\docker-compose.yaml up -d

Write-Host "`n[CD] Service status:" -ForegroundColor Green
docker compose -f .\docker-compose.yaml ps

Write-Host "`n✅ Frontend CI/CD finished successfully." -ForegroundColor Green
