#!/usr/bin/env bash
# Shared GHCR image naming for build / push / run scripts.
# shellcheck disable=SC2034

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/deploy/docker-registry.env" ]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/deploy/docker-registry.env"
  set +a
fi

GHCR_OWNER="${GHCR_OWNER:-palash62}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-ghcr.io}"

CPL_PLATFORM_IMAGE="${CPL_PLATFORM_IMAGE:-${REGISTRY}/${GHCR_OWNER}/affsense-platform:${IMAGE_TAG}}"
CPL_TRACKING_IMAGE="${CPL_TRACKING_IMAGE:-${REGISTRY}/${GHCR_OWNER}/affsense-tracking:${IMAGE_TAG}}"

export GHCR_OWNER IMAGE_TAG REGISTRY CPL_PLATFORM_IMAGE CPL_TRACKING_IMAGE
