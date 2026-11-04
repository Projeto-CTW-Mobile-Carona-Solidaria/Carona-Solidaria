param(
    [ValidateSet('init', 'up', 'backend', 'down', 'status', 'validate')]
    [string]$Action = 'up',
    [string]$Maven = 'mvn'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$stackRoot = Join-Path $projectRoot 'observability'
$secretRoot = Join-Path $stackRoot '.secrets'
$composeFile = Join-Path $stackRoot 'compose.yaml'
$logsRoot = Join-Path $projectRoot 'backend/logs'

function Initialize-Observability {
    New-Item -ItemType Directory -Force -Path $secretRoot, $logsRoot | Out-Null
    foreach ($name in @('metrics-token', 'grafana-admin-password')) {
        $secretPath = Join-Path $secretRoot $name
        if (-not (Test-Path -LiteralPath $secretPath)) {
            $bytes = New-Object byte[] 32
            $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
            $secret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
            [IO.File]::WriteAllText($secretPath, $secret, (New-Object System.Text.UTF8Encoding($false)))
        }
        if (([IO.File]::ReadAllText($secretPath)).Trim() -notmatch '^[a-f0-9]{64}$') {
            throw "Invalid local secret in $secretPath. Expected 64 lowercase hexadecimal characters."
        }
    }
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    & docker compose -f $composeFile @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose failed. Check that Docker Desktop is running.' }
}

switch ($Action) {
    'init' {
        Initialize-Observability
        Write-Host 'Local secrets initialized; existing credentials were preserved.'
    }
    'up' {
        Initialize-Observability
        Invoke-Compose -ComposeArgs @('up', '-d')
        $grafanaPort = if ($env:GRAFANA_PORT) { $env:GRAFANA_PORT } else { '3300' }
        Write-Host "Grafana: http://localhost:$grafanaPort (user: admin)"
        Write-Host "Password file: $(Join-Path $secretRoot 'grafana-admin-password')"
        Write-Host 'Start the API in another terminal: ./scripts/observability.ps1 -Action backend'
    }
    'backend' {
        Initialize-Observability
        if (-not (Get-Command $Maven -ErrorAction SilentlyContinue)) { throw 'Maven was not found.' }
        $previousToken = $env:METRICS_TOKEN
        $previousProfiles = $env:SPRING_PROFILES_ACTIVE
        $previousLogFile = $env:LOG_FILE
        try {
            $env:METRICS_TOKEN = [IO.File]::ReadAllText((Join-Path $secretRoot 'metrics-token')).Trim()
            $env:SPRING_PROFILES_ACTIVE = (@($previousProfiles -split ',' | Where-Object { $_ }) + 'observability' | Select-Object -Unique) -join ','
            $env:LOG_FILE = Join-Path $logsRoot 'application.json'
            Push-Location $projectRoot
            try {
                & $Maven -pl backend spring-boot:run
                if ($LASTEXITCODE -ne 0) { throw 'Backend failed.' }
            } finally { Pop-Location }
        } finally {
            $env:METRICS_TOKEN = $previousToken
            $env:SPRING_PROFILES_ACTIVE = $previousProfiles
            $env:LOG_FILE = $previousLogFile
        }
    }
    'down' { Invoke-Compose -ComposeArgs @('down') }
    'status' { Invoke-Compose -ComposeArgs @('ps') }
    'validate' {
        Initialize-Observability
        Invoke-Compose -ComposeArgs @('config', '--quiet')
        Invoke-Compose -ComposeArgs @('run', '--rm', '--no-deps', '--entrypoint', 'promtool', 'prometheus', 'check', 'config', '/etc/prometheus/prometheus.yml')
        Invoke-Compose -ComposeArgs @('run', '--rm', '--no-deps', 'loki', '-config.file=/etc/loki/config.yml', '-verify-config=true')
        Invoke-Compose -ComposeArgs @('run', '--rm', '--no-deps', 'alloy', 'validate', '/etc/alloy/config.alloy')
    }
}
