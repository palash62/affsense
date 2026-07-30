#!/usr/bin/env bash
# Push package-only images to GitHub Container Registry (GHCR).
# Requires: docker login ghcr.io (PAT with write:packages) OR CI GITHUB_TOKEN.
#
# Production :latest should come from GitHub Actions. Local pushes of :latest are
# blocked by default (Windows builds previously overwrote CI and broke Prisma/jsdom).
# Emergency override: ALLOW_LOCAL_LATEST_PUSH=1 bash deploy/docker-push.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=deploy/docker-registry.sh
source "$ROOT/deploy/docker-registry.sh"

need_images=0
if ! docker image inspect "$CPL_PLATFORM_IMAGE" >/dev/null 2>&1; then
  need_images=1
fi
if ! docker image inspect "$CPL_TRACKING_IMAGE" >/dev/null 2>&1; then
  need_images=1
fi

if [ "$need_images" -eq 1 ]; then
  echo "Tagged images not found. Build first:"
  echo "  bash deploy/docker-build-images.sh"
  exit 1
fi

is_latest_tag() {
  case "$1" in
    *:latest) return 0 ;;
    *) return 1 ;;
  esac
}

if { is_latest_tag "$CPL_PLATFORM_IMAGE" || is_latest_tag "$CPL_TRACKING_IMAGE"; } \
  && [ "${ALLOW_LOCAL_LATEST_PUSH:-0}" != "1" ]; then
  echo "Refusing to push :latest from this machine."
  echo "Production :latest is owned by GitHub Actions (Docker images / GHCR workflow)."
  echo "Local Windows/Mac builds can overwrite CI images and break hashed standalone packages."
  echo ""
  echo "Options:"
  echo "  1. Push to master and let Actions publish :latest + :<sha>"
  echo "  2. Tag/push a non-latest tag, e.g. IMAGE_TAG=local-test bash deploy/docker-push.sh"
  echo "  3. Emergency only: ALLOW_LOCAL_LATEST_PUSH=1 bash deploy/docker-push.sh"
  exit 1
fi

echo "==> Verifying images before push..."
# Prefer local :latest tags when verifying; fall back to registry-named tags.
if docker image inspect cpl-platform:latest >/dev/null 2>&1; then
  bash "$ROOT/deploy/verify-standalone-image.sh" cpl-platform:latest platform
else
  bash "$ROOT/deploy/verify-standalone-image.sh" "$CPL_PLATFORM_IMAGE" platform
fi
if docker image inspect cpl-tracking:latest >/dev/null 2>&1; then
  bash "$ROOT/deploy/verify-standalone-image.sh" cpl-tracking:latest tracking
else
  bash "$ROOT/deploy/verify-standalone-image.sh" "$CPL_TRACKING_IMAGE" tracking
fi

echo "==> Pushing $CPL_PLATFORM_IMAGE"
docker push "$CPL_PLATFORM_IMAGE"

echo "==> Pushing $CPL_TRACKING_IMAGE"
docker push "$CPL_TRACKING_IMAGE"

echo ""
echo "Pushed. On the 2GB server (after docker login ghcr.io if packages are private):"
echo "  bash deploy/docker-run.sh"
