#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ContainerCmd = if (Get-Command podman -ErrorAction SilentlyContinue) { "podman" } `
                elseif (Get-Command docker -ErrorAction SilentlyContinue) { "docker" } `
                else { $null }
if (-not $ContainerCmd) {
    Write-Error "Neither podman nor docker found."
    exit 1
}

$ContainerName = "finance-ally"

$running = & $ContainerCmd ps -q --filter "name=^${ContainerName}$"
if ($running) {
    Write-Host "Stopping $ContainerName..."
    & $ContainerCmd stop $ContainerName | Out-Null
    & $ContainerCmd rm $ContainerName | Out-Null
    Write-Host "Stopped. (Volume finance-ally-data preserved.)"
} else {
    Write-Host "Container $ContainerName is not running."
}
