# Smoke test da API (PowerShell). Uso: .\scripts\smoke-test.ps1
param(
  [string] $BaseUrl = "http://127.0.0.1:3000",
  [int] $TimeoutSec = 15
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param([string] $Uri)
  Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec $TimeoutSec
}

$healthUri = $BaseUrl + "/health"
$listUri = $BaseUrl + "/api/requests?limit=5&offset=0"

Write-Host ">>> Health" -ForegroundColor Cyan
Write-Host $healthUri
$h = Invoke-Json -Uri $healthUri
$h | ConvertTo-Json -Depth 5 -Compress

Write-Host ""
Write-Host ">>> Lista" -ForegroundColor Cyan
Write-Host $listUri
$list = Invoke-Json -Uri $listUri
$list | ConvertTo-Json -Depth 6 -Compress

Write-Host ""
Write-Host ('OK em ' + $TimeoutSec + 's max por pedido.') -ForegroundColor Green
