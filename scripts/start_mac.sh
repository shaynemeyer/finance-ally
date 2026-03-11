#!/usr/bin/env bash
set -euo pipefail

CONTAINER_CMD=$(command -v podman 2>/dev/null || command -v docker 2>/dev/null || true)
if [[ -z "$CONTAINER_CMD" ]]; then
  echo "Error: neither podman nor docker found. Install one and try again."
  exit 1
fi

IMAGE_NAME="finance-ally"
CONTAINER_NAME="finance-ally"

if [[ ! -f .env ]]; then
  echo "Error: .env file not found. Copy .env.example to .env and set your API keys."
  exit 1
fi

# Build if --build flag passed or image does not exist
if [[ "${1:-}" == "--build" ]] || ! "$CONTAINER_CMD" image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building $IMAGE_NAME..."
  "$CONTAINER_CMD" build -t "$IMAGE_NAME" .
fi

# If already running, just print the URL
if "$CONTAINER_CMD" ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Finance Ally is already running at http://localhost:8000"
  exit 0
fi

# Remove stopped container if one exists with the same name
if "$CONTAINER_CMD" ps -aq --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  "$CONTAINER_CMD" rm "$CONTAINER_NAME"
fi

echo "Starting $CONTAINER_NAME..."
"$CONTAINER_CMD" run -d \
  --name "$CONTAINER_NAME" \
  -p 8000:8000 \
  -v finance-ally-data:/app/db \
  --env-file .env \
  "$IMAGE_NAME"

echo "Finance Ally is running at http://localhost:8000"

if command -v open &>/dev/null; then
  open http://localhost:8000
fi
