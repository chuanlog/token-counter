param(
  [int]$Port = 1236
)

$ErrorActionPreference = 'Continue'
$pidFile = Join-Path (Join-Path $PSScriptRoot 'data') ("token-counter-{0}.pid" -f $Port)

function Get-ListenerPids {
  $found = @()
  try {
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    foreach ($connection in $connections) {
      if ($connection.OwningProcess -gt 0) { $found += [int]$connection.OwningProcess }
    }
  } catch {
    try {
      $lines = & netstat -ano 2>$null | Select-String -Pattern ":$Port\s" | Select-String -Pattern 'LISTENING'
      foreach ($line in $lines) {
        $parts = @($line.Line.Trim() -split '\s+')
        $candidate = $parts[-1]
        if ($candidate -match '^\d+$') { $found += [int]$candidate }
      }
    } catch {
      # Ignore; caller reports no listener.
    }
  }
  return @($found | Sort-Object -Unique | Where-Object { $_ -gt 0 })
}

function Test-TokenLensProcess([int]$ProcessId) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  if ([string]$process.Name -notmatch '^node(\.exe)?$') { return $null }
  $commandLine = [string]$process.CommandLine
  if ($commandLine -match 'server[\\/]index\.js') {
    return $process
  }
  return $null
}

$listenerPids = @(Get-ListenerPids)
$matched = @()

foreach ($processId in $listenerPids) {
  $process = Test-TokenLensProcess -ProcessId $processId
  if ($process) {
    $matched += [pscustomobject]@{ Id = $processId; Name = $process.Name }
  }
}

if ($matched.Count -eq 0) {
  if ($listenerPids.Count -gt 0) {
    Write-Host "[Token Lens] Port $Port is used by another process. Refusing to stop it."
    Write-Host "[Token Lens] Close that process, or run Token Lens with --port <other-port>."
    exit 1
  }
  Write-Host "[Token Lens] No server is listening on port $Port."
  if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
  exit 1
}

Write-Host "[Token Lens] Stopping Token Lens on port $Port..."

$graceful = $false
try {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/shutdown" `
    -Headers @{ 'X-Token-Lens' = 'shutdown' } -TimeoutSec 2 | Out-Null
  $graceful = $true
} catch {
  # Older builds without /api/shutdown are stopped by process termination below.
}

if ($graceful) {
  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Milliseconds 150
    if (@(Get-ListenerPids).Count -eq 0) { break }
  }
}

if (@(Get-ListenerPids).Count -gt 0) {
  foreach ($item in $matched) {
    Write-Host "[Token Lens] Force stopping PID $($item.Id) ($($item.Name))..."
    Stop-Process -Id $item.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 400
}

if (@(Get-ListenerPids).Count -gt 0) {
  Write-Host "[Token Lens] Failed to free port $Port."
  exit 1
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "[Token Lens] Server stopped. Port $Port is free."
exit 0
