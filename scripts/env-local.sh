#!/usr/bin/env bash
# Restore localhost .env files for local development.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Use 3010 locally — Cursor often forwards remote production on localhost:3000.
LOCAL_PLATFORM_PORT="${LOCAL_PLATFORM_PORT:-3010}"
LOCAL_PLATFORM_URL="http://localhost:${LOCAL_PLATFORM_PORT}"

# Docker Desktop MySQL (affsense-mysql): host 3308 → container 3306
DATABASE_URL="${DATABASE_URL:-mysql://root@localhost:3308/affsense}"
INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN:-dev-internal-token-change-in-production-64chars-minimum!!}"
AUTH_SECRET="${AUTH_SECRET:-dev-secret-change-in-production-min-32-chars}"

if [[ "$DATABASE_URL" != *"connection_limit="* ]]; then
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    DATABASE_URL="${DATABASE_URL}&connection_limit=10&pool_timeout=20"
  else
    DATABASE_URL="${DATABASE_URL}?connection_limit=10&pool_timeout=20"
  fi
fi

mkdir -p "$ROOT/packages/database"
cat > "$ROOT/packages/database/.env" <<EOF
DATABASE_URL="$DATABASE_URL"
EOF

cat > "$ROOT/apps/platform/.env" <<EOF
DATABASE_URL="$DATABASE_URL"
INTERNAL_SERVICE_TOKEN="$INTERNAL_SERVICE_TOKEN"
AUTH_SECRET="$AUTH_SECRET"
AUTH_URL="$LOCAL_PLATFORM_URL"
AUTH_TRUST_HOST="true"
APP_URL="$LOCAL_PLATFORM_URL"
PLATFORM_URL="$LOCAL_PLATFORM_URL"
TRACKING_URL="http://localhost:3001"
NEXT_PUBLIC_PLATFORM_URL="$LOCAL_PLATFORM_URL"
NEXT_PUBLIC_TRACKING_URL="http://localhost:3001"
PORT=$LOCAL_PLATFORM_PORT
# Transactional email (uncomment one provider to test locally):
# Mailgun (preferred):
# MAILGUN_API_KEY="key-..."
# MAILGUN_DOMAIN="mg.example.com"
# MAILGUN_FROM="LeadVix <noreply@mg.example.com>"
# SMTP (e.g. Mailtrap):
# SMTP_HOST="sandbox.smtp.mailtrap.io"
# SMTP_PORT="587"
# SMTP_USER="..."
# SMTP_PASS="..."
# SMTP_FROM="LeadVix <noreply@leadvix.local>"
EOF

cat > "$ROOT/apps/tracking/.env" <<EOF
DATABASE_URL="$DATABASE_URL"
INTERNAL_SERVICE_TOKEN="$INTERNAL_SERVICE_TOKEN"
TRACKING_URL="http://localhost:3001"
PLATFORM_URL="$LOCAL_PLATFORM_URL"
NEXT_PUBLIC_TRACKING_URL="http://localhost:3001"
NEXT_PUBLIC_PLATFORM_URL="$LOCAL_PLATFORM_URL"
PORT=3001
EOF

echo "Wrote local dev env:"
echo "  Platform:  $LOCAL_PLATFORM_URL"
echo "  Tracking:  http://localhost:3001"
echo "  Note: avoid http://localhost:3000 — Cursor may forward that to production."
