#!/usr/bin/env bash
set -euo pipefail

CONTAINER_CMD=$(command -v podman 2>/dev/null || command -v docker 2>/dev/null || true)
if [[ -z "$CONTAINER_CMD" ]]; then
  echo "Error: neither podman nor docker found."
  exit 1
fi

CONTAINER_NAME="finance-ally"

if "$CONTAINER_CMD" ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping $CONTAINER_NAME..."
  "$CONTAINER_CMD" stop "$CONTAINER_NAME"
  "$CONTAINER_CMD" rm "$CONTAINER_NAME"
  echo "Stopped. (Volume finance-ally-data preserved.)"
else
  echo "Container $CONTAINER_NAME is not running."
fi
