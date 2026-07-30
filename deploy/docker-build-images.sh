#!/usr/bin/env bash
# Run on a machine with enough RAM (laptop / CI). Builds Next apps then packages
# slim Docker images and tags them for GHCR. Do NOT run on a 2GB production VPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=deploy/docker-registry.sh
source "$ROOT/deploy/docker-registry.sh"

if command -v free >/dev/null 2>&1; then
  mem_mb="$(free -m | awk '/^Mem:/{print $2}')"
  if [ "${mem_mb:-0}" -gt 0 ] && [ "$mem_mb" -lt 2800 ]; then
    echo "WARNING: ~${mem_mb}MB RAM detected."
    echo "This script compiles Next.js and needs ~3GB+ free. Aborting."
    echo "Use GitHub Actions (push to master) or run on your laptop, then:"
    echo "  bash deploy/docker-push.sh"
    exit 1
  fi
fi

SKIP_NPM_CI="${SKIP_NPM_CI:-0}"

if [ "$SKIP_NPM_CI" != "1" ]; then
  echo "==> npm ci..."
  npm ci
fi

echo "==> Prisma generate..."
npm run generate --workspace @cpl/database

echo "==> Production Next builds (needs ~3GB+ free RAM)..."
npm run build:production

echo "==> Prepare standalone assets..."
bash "$ROOT/deploy/prepare-standalone.sh"

echo "==> Docker package (copy artifacts only — no Next compile inside Docker)..."
docker build -f Dockerfile.platform \
  -t cpl-platform:latest \
  -t "$CPL_PLATFORM_IMAGE" \
  .
docker build -f Dockerfile.tracking \
  -t cpl-tracking:latest \
  -t "$CPL_TRACKING_IMAGE" \
  .

echo "==> Verify standalone images (hashed externals / Prisma / no host symlinks)..."
bash "$ROOT/deploy/verify-standalone-image.sh" cpl-platform:latest platform
bash "$ROOT/deploy/verify-standalone-image.sh" cpl-tracking:latest tracking

if [ "${SAVE_TAR:-0}" = "1" ]; then
  OUT="$ROOT/deploy/cpl-docker-images.tar"
  echo "==> Saving offline archive to $OUT ..."
  docker save "$CPL_PLATFORM_IMAGE" "$CPL_TRACKING_IMAGE" -o "$OUT"
  echo "  archive: $OUT"
fi

echo ""
echo "Images ready:"
echo "  $CPL_PLATFORM_IMAGE"
echo "  $CPL_TRACKING_IMAGE"
echo ""
echo "Push to registry, then run on the 2GB server:"
echo "  bash deploy/docker-push.sh"
echo "  # on server:"
echo "  bash deploy/docker-run.sh"
