param(
    [ValidateSet('test','build','backend','desktop')][string]$Action = 'test',
    [string]$Maven = 'mvn'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    if (-not (Get-Command $Maven -ErrorAction SilentlyContinue)) {
        throw 'Maven não encontrado. Instale Maven 3.6.3+ ou informe -Maven com o caminho completo para mvn.cmd.'
    }
    switch ($Action) {
        'test' { & $Maven test }
        'build' { & $Maven package }
        'backend' { & $Maven -pl backend spring-boot:run }
        'desktop' {
            & $Maven -pl desktop -am package
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & java -jar desktop/target/desktop-1.0.0.jar
        }
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
