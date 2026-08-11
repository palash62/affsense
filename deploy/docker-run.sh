#!/usr/bin/env bash
# Server-side only: pull prebuilt images from GHCR and start containers.
# Does NOT build Next.js or Docker images (safe for ~2GB RAM).
#
# Fallback offline: IMAGE_SOURCE=tar bash deploy/docker-run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

# shellcheck source=deploy/docker-registry.sh
source "$ROOT/deploy/docker-registry.sh"

IMAGE_SOURCE="${IMAGE_SOURCE:-registry}"
IMAGE_TAR="${IMAGE_TAR:-$ROOT/deploy/cpl-docker-images.tar}"
COMPOSE=("${DOCKER[@]}" compose -f docker-compose.prod.yml)

if [ ! -f apps/platform/.env ] || [ ! -f apps/tracking/.env ]; then
  echo "Missing .env files for production."
  echo "Run: bash deploy/env-production.sh"
  echo "Then set real production values in apps/platform/.env and apps/tracking/.env"
  exit 1
fi

mkdir -p /var/lib/cpl/platform-uploads/builder /var/lib/cpl/platform-uploads/landing-pages
sudo chown -R ubuntu:www-data /var/lib/cpl/platform-uploads 2>/dev/null || true
sudo chmod -R 775 /var/lib/cpl/platform-uploads 2>/dev/null || true

# Stop interim host processes that may hold ports 3000/3001 (e.g. manual standalone start).
for port in 3000 3001; do
  pid="$(ss -tlnp 2>/dev/null | awk -v p=":$port" '$4 ~ p { if (match($0, /pid=([0-9]+)/, m)) print m[1] }' | head -1)"
  if [ -n "${pid:-}" ]; then
    echo "==> Stopping host process on port $port (pid $pid) before starting containers..."
    kill "$pid" 2>/dev/null || sudo kill "$pid" 2>/dev/null || true
    sleep 1
  fi
done

if [ "$IMAGE_SOURCE" = "tar" ]; then
  if [ ! -f "$IMAGE_TAR" ]; then
    echo "IMAGE_SOURCE=tar but missing $IMAGE_TAR"
    exit 1
  fi
  echo "==> Loading images from $IMAGE_TAR (offline)..."
  "${DOCKER[@]}" load -i "$IMAGE_TAR"
else
  echo "==> Pulling from registry (no build)..."
  echo "  $CPL_PLATFORM_IMAGE"
  echo "  $CPL_TRACKING_IMAGE"
  if ! "${COMPOSE[@]}" pull; then
    echo ""
    echo "Pull failed. If packages are private, login once on this server:"
    echo "  echo YOUR_GITHUB_PAT | docker login ghcr.io -u ${GHCR_OWNER} --password-stdin"
    echo "PAT needs read:packages. Or make packages public in GitHub Packages settings."
    echo ""
    echo "Offline fallback after scp of the tar:"
    echo "  IMAGE_SOURCE=tar bash deploy/docker-run.sh"
    exit 1
  fi
fi

echo "==> Starting containers (runtime only, no --build)..."
"${COMPOSE[@]}" up -d --no-build --pull never --force-recreate

echo "==> Running containers:"
"${COMPOSE[@]}" ps

echo ""
echo "Platform:  http://localhost:3000"
echo "Tracking:  http://localhost:3001"
echo ""
echo "Images: $CPL_PLATFORM_IMAGE | $CPL_TRACKING_IMAGE"
echo "Memory caps: platform 900m | tracking 500m"
echo ""
echo "After pulling new images, sync the database schema on this host:"
echo "  cd $ROOT && npm run db:push"
echo "  ${COMPOSE[@]} restart"
echo "  (Required after schema changes, e.g. partner_payments for /admin/profit)"
echo ""
echo "Update checklist (when code/env changed on GitHub):"
echo "  1. git pull"
echo "  2. export MAILGUN_API_KEY MAILGUN_DOMAIN MAILGUN_FROM (and AUTH_SECRET if first run)"
echo "  3. bash deploy/env-production.sh   # preserves existing secrets when not exported"
echo "  4. bash deploy/docker-run.sh"
echo "  5. npm run db:push   # creates/updates tables (partner_payments, etc.) — skip this and /admin/profit can 500"
echo "  6. Restart email worker (required after Prisma/schema or email-marketing changes):"
echo "       pkill -f 'email.worker' || true"
echo "       cd $ROOT && set -a && source apps/platform/.env && set +a && npm run worker:email >> /tmp/cpl-email-worker.log 2>&1 &"
echo "     Or with PM2: pm2 restart cpl-email-worker  (see ecosystem.config.js)"
echo "  7. Optional: re-queue stuck sends — npx tsx apps/platform/scripts/reconcile-email-sends.ts"
echo ""
echo "First run or recovery (env + seed + smoke test):"
echo "  bash $ROOT/deploy/bootstrap-production.sh"
