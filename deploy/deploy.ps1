# Überträgt die Materialdatenbank auf den Server und startet sie neu (Windows PowerShell).
#
# Aufruf:  .\deploy\deploy.ps1 -Server 203.0.113.10 -User meinbenutzer
#   oder:  $env:FAWOWA_SERVER = '203.0.113.10'; $env:FAWOWA_USER = 'meinbenutzer'; .\deploy\deploy.ps1
#
# Voraussetzungen: ssh/scp/tar (in Windows enthalten), SSH-Schlüssel für einen Benutzer in der Gruppe "docker",
# Docker und das Netzwerk "caddy-net" auf dem Server (siehe deploy/README.md).
# Die Datenbank (data/), die .env und Zertifikate auf dem Server werden NICHT überschrieben.
# Falls Windows das Skript blockiert: powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 ...

param(
  [string]$Server = $env:FAWOWA_SERVER,
  [string]$User = $env:FAWOWA_USER,
  [string]$Key = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_fawowa'),
  [string]$Ziel = '/srv/apps/materialtabelle',
  # Nur das Image bauen, den laufenden Container aber nicht anfassen (für eine Umstellung mit kurzer Pause)
  [switch]$NurBauen
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 macht aus jeder Zeile, die ein Programm auf stderr schreibt, einen Fehler (Docker meldet
# damit seinen Fortschritt). Programme laufen deshalb mit 'Continue'; geprüft wird nur der Exit-Code.
function Invoke-Nativ([scriptblock]$Block) {
  $vorher = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Block } finally { $ErrorActionPreference = $vorher }
}
if (-not $Server) { throw 'Bitte -Server angeben oder $env:FAWOWA_SERVER setzen.' }
if (-not $User) { throw 'Bitte -User angeben oder $env:FAWOWA_USER setzen.' }

$projekt = Split-Path -Parent $PSScriptRoot
$archiv = Join-Path $env:TEMP 'fawowa-deploy.tar.gz'
$ssh = @('-i', $Key, '-o', 'IdentitiesOnly=yes', "$User@$Server")

Write-Host '1/4 Archiv packen ...'
Push-Location $projekt
try {
  if (Test-Path $archiv) { Remove-Item $archiv }
  # Nur die ausdrücklich genannten Dateien und Ordner kommen ins Archiv; data/, .env, .git und tests/ gehören nicht dazu.
  Invoke-Nativ { tar -czf $archiv --exclude=node_modules `
    Dockerfile docker-compose.yml .dockerignore package.json package-lock.json `
    server.js vite.config.js index.html admin.html src lib scripts docs/startdaten.csv }
  if ($LASTEXITCODE -ne 0) { throw 'tar ist fehlgeschlagen.' }
} finally { Pop-Location }

Write-Host '2/4 Auf den Server kopieren ...'
Invoke-Nativ { scp -i $Key -o IdentitiesOnly=yes $archiv "${User}@${Server}:/tmp/fawowa-deploy.tar.gz" }
if ($LASTEXITCODE -ne 0) { throw 'scp ist fehlgeschlagen.' }

$befehl = if ($NurBauen) { 'docker compose build' } else { 'docker compose up -d --build' }
Write-Host "3/4 Entpacken und bauen ($befehl) ..."
Invoke-Nativ { ssh @ssh "mkdir -p $Ziel/data && cd $Ziel && tar -xzf /tmp/fawowa-deploy.tar.gz && rm /tmp/fawowa-deploy.tar.gz && $befehl 2>&1" }
if ($LASTEXITCODE -ne 0) { throw "Bauen oder Starten auf dem Server ist fehlgeschlagen (Exit-Code $LASTEXITCODE)." }

Write-Host '4/4 Zustand prüfen ...'
Invoke-Nativ { ssh @ssh "cd $Ziel && docker compose ps 2>&1 && docker image prune -f > /dev/null" }

Write-Host 'Fertig.'
