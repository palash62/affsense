#!/usr/bin/env bash
# Idempotent first-run / recovery bootstrap for production VPS.
# Ensures env, database seed, Docker runtime, and smoke checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PLATFORM_URL="${PLATFORM_URL:-https://leadvix.io}"
TRACKING_URL="${TRACKING_URL:-https://track.leadtb.com}"
DATABASE_URL="${DATABASE_URL:-mysql://cpl:cpl_dev_pass@localhost:3306/cpl}"

echo "==> CPL production bootstrap"
echo "    Platform: $PLATFORM_URL"
echo "    Tracking: $TRACKING_URL"

# --- MySQL reachable ---
echo "==> Checking MySQL..."
if ! mysql --protocol=TCP -h 127.0.0.1 -u cpl -pcpl_dev_pass -e "SELECT 1" >/dev/null 2>&1; then
  echo "ERROR: Cannot connect to MySQL as cpl@localhost."
  echo "Ensure MySQL is running and the cpl user/database exist."
  exit 1
fi

# --- Secrets: generate if placeholders ---
AUTH_SECRET="${AUTH_SECRET:-}"
INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN:-}"

if [ -z "$AUTH_SECRET" ] && [ -f apps/platform/.env ]; then
  AUTH_SECRET="$(grep -E '^AUTH_SECRET=' apps/platform/.env | cut -d= -f2- || true)"
fi
if [ -z "$INTERNAL_SERVICE_TOKEN" ] && [ -f apps/platform/.env ]; then
  INTERNAL_SERVICE_TOKEN="$(grep -E '^INTERNAL_SERVICE_TOKEN=' apps/platform/.env | cut -d= -f2- || true)"
fi

if [[ "${AUTH_SECRET:-}" == change-me* ]] || [ -z "${AUTH_SECRET:-}" ]; then
  AUTH_SECRET="$(openssl rand -base64 48)"
  echo "==> Generated new AUTH_SECRET"
fi
if [[ "${INTERNAL_SERVICE_TOKEN:-}" == change-me* ]] || [ -z "${INTERNAL_SERVICE_TOKEN:-}" ]; then
  INTERNAL_SERVICE_TOKEN="$(openssl rand -base64 48)"
  echo "==> Generated new INTERNAL_SERVICE_TOKEN"
fi

export PLATFORM_URL TRACKING_URL DATABASE_URL AUTH_SECRET INTERNAL_SERVICE_TOKEN
bash "$ROOT/deploy/env-production.sh"

# --- Database schema + seed ---
echo "==> Syncing database schema..."
npm run db:push

echo "==> Seeding database (idempotent upserts)..."
npm run db:seed

# --- Flush leaked connections before restart ---
echo "==> Flushing idle MySQL connections for cpl user..."
sudo mysql -e "KILL USER 'cpl';" 2>/dev/null || true
sleep 2

# --- Start / update containers (pull prebuilt images; build on laptop/CI only) ---
echo "==> Starting Docker containers (pull from registry or load from tar)..."
echo "    Build images locally: bash deploy/docker-build-images.sh && bash deploy/docker-push.sh"
echo "    Or offline: IMAGE_SOURCE=tar bash deploy/docker-run.sh"
bash "$ROOT/deploy/docker-run.sh"

# --- Sequential restart: tracking first, then platform ---
echo "==> Restarting tracking, then platform..."
if docker info >/dev/null 2>&1; then DOCKER=docker; else DOCKER="sudo docker"; fi
$DOCKER restart cpl-tracking
sleep 5
$DOCKER restart cpl-platform
sleep 10

# --- Smoke test ---
echo "==> Running smoke test..."
export PLATFORM_URL TRACKING_URL INTERNAL_SERVICE_TOKEN
if ! npm run test:smoke; then
  echo ""
  echo "Smoke test failed. Check logs:"
  echo "  docker logs cpl-platform --tail 50"
  echo "  docker logs cpl-tracking --tail 50"
  exit 1
fi

echo ""
echo "Bootstrap complete."
echo "  Platform:  $PLATFORM_URL"
echo "  Tracking:  $TRACKING_URL"
echo "  Demo form: $TRACKING_URL/t/demo-link"
echo "  Login:     admin@cpl.local / password123"
