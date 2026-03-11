#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ContainerCmd = if (Get-Command podman -ErrorAction SilentlyContinue) { "podman" } `
                elseif (Get-Command docker -ErrorAction SilentlyContinue) { "docker" } `
                else { $null }
if (-not $ContainerCmd) {
    Write-Error "Neither podman nor docker found. Install one and try again."
    exit 1
}

$ImageName = "finance-ally"
$ContainerName = "finance-ally"

if (-not (Test-Path ".env")) {
    Write-Error ".env file not found. Copy .env.example to .env and set your API keys."
    exit 1
}

# Build if --build flag passed or image does not exist
& $ContainerCmd image inspect $ImageName 2>$null | Out-Null
$imageExists = $LASTEXITCODE -eq 0
if ($args -contains "--build" -or -not $imageExists) {
    Write-Host "Building $ImageName..."
    & $ContainerCmd build -t $ImageName .
}

# If already running, just print URL
$running = & $ContainerCmd ps -q --filter "name=^${ContainerName}$"
if ($running) {
    Write-Host "Finance Ally is already running at http://localhost:8000"
    exit 0
}

# Remove stopped container if it exists
$exists = & $ContainerCmd ps -aq --filter "name=^${ContainerName}$"
if ($exists) {
    & $ContainerCmd rm $ContainerName | Out-Null
}

Write-Host "Starting $ContainerName..."
& $ContainerCmd run -d `
    --name $ContainerName `
    -p 8000:8000 `
    -v "finance-ally-data:/app/db" `
    --env-file .env `
    $ImageName

Write-Host "Finance Ally is running at http://localhost:8000"
Start-Process "http://localhost:8000"
