# Start and stop the whole bakery — database, admin and customer — in one step.
#
#   .\bakery.ps1          start everything
#   .\bakery.ps1 stop     stop it, keeping the database and photos
#   .\bakery.ps1 rebuild  rebuild the images first, then start
#   .\bakery.ps1 logs     follow the logs
#   .\bakery.ps1 status   what is running
#
# Runs from anywhere: the compose file is found relative to this script, not to
# whatever directory the terminal happens to be sitting in — which matters
# because a terminal left in a renamed folder fails in a confusing way.

param(
    [ValidateSet("start", "stop", "rebuild", "logs", "status")]
    [string]$Action = "start"
)

$compose = Join-Path $PSScriptRoot "docker-compose.yml"

if (-not (Test-Path $compose)) {
    Write-Error "docker-compose.yml not found next to this script ($PSScriptRoot)."
    exit 1
}

switch ($Action) {
    "start" {
        docker compose -f $compose up -d
    }
    "rebuild" {
        docker compose -f $compose up -d --build
    }
    "stop" {
        # No -v: the database and the uploaded photos live in named volumes and
        # are deliberately kept.
        docker compose -f $compose down
        Write-Output ""
        Write-Output "Stopped. The database and photos are kept."
        return
    }
    "logs" {
        docker compose -f $compose logs -f
        return
    }
    "status" {
        docker compose -f $compose ps
        return
    }
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output ""
Write-Output "  Customer menu   http://localhost:3000"
Write-Output "  Admin dashboard http://localhost:3001"
