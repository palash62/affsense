#!/usr/bin/env bash
# Verify a package-only Next standalone Docker image is safe to ship.
# Catches broken hashed externals (jsdom-<hash>, @prisma/client-<hash>) that are
# still absolute host symlinks/junctions and would 500 at runtime in Linux containers.
#
# Usage: bash deploy/verify-standalone-image.sh <image> <platform|tracking>
set -euo pipefail

IMAGE="${1:-}"
APP="${2:-}"

if [ -z "$IMAGE" ] || [ -z "$APP" ]; then
  echo "Usage: $0 <image> <platform|tracking>" >&2
  exit 2
fi

if [ "$APP" != "platform" ] && [ "$APP" != "tracking" ]; then
  echo "APP must be platform or tracking (got: $APP)" >&2
  exit 2
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: image not found locally: $IMAGE" >&2
  exit 1
fi

echo "==> Verifying standalone image: $IMAGE (app=$APP)"

# Git Bash on Windows rewrites /bin/sh → a host path; disable that for docker args.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

docker run --rm \
  -e "VERIFY_APP=$APP" \
  -e "VERIFY_IMAGE_LABEL=$IMAGE" \
  --entrypoint /bin/sh \
  "$IMAGE" \
  -ec '
set -eu
failed=0
APP="$VERIFY_APP"

fail() {
  echo "ERROR: $*" >&2
  failed=1
}

echo "-- check absolute / host-path symlinks --"
find /app -type l > /tmp/symlinks.txt 2>/dev/null || true
while IFS= read -r link; do
  [ -z "$link" ] && continue
  target=$(readlink "$link" || true)
  case "$target" in
    /home/runner/*|/d/*|/D/*|D:/*|d:/*|C:/*|c:/*)
      fail "host-path symlink will break in container: $link -> $target"
      ;;
    /*)
      case "$target" in
        /app/*) ;;
        *) fail "absolute symlink outside /app: $link -> $target" ;;
      esac
      ;;
  esac
  if [ ! -e "$link" ]; then
    fail "dangling symlink: $link -> $target"
  fi
done < /tmp/symlinks.txt

NM="/app/apps/${APP}/.next/node_modules"
if [ -d "$NM" ]; then
  echo "-- check hashed externals under $NM --"
  find "$NM" -type l > /tmp/nm_symlinks.txt 2>/dev/null || true
  if [ -s /tmp/nm_symlinks.txt ]; then
    fail "symlinks remain under $NM:"
    cat /tmp/nm_symlinks.txt >&2 || true
  fi

  find "$NM" -mindepth 1 -maxdepth 2 -type d > /tmp/nm_dirs.txt 2>/dev/null || true
  while IFS= read -r dir; do
    [ -z "$dir" ] && continue
    base=$(basename "$dir")
    case "$base" in
      *-*) ;;
      *) continue ;;
    esac
    hashpart=${base##*-}
    [ -n "$hashpart" ] || continue
    [ "$hashpart" = "$base" ] && continue
    case "$hashpart" in
      *[!a-f0-9]*) continue ;;
    esac
    [ "${#hashpart}" -ge 8 ] || continue
    if [ ! -f "$dir/package.json" ]; then
      fail "hashed package missing package.json: $dir"
    else
      echo "  OK hashed package: $dir"
    fi
  done < /tmp/nm_dirs.txt
else
  echo "-- no $NM (OK if Next did not emit traced hashed externals) --"
fi

echo "-- check Prisma Linux engine --"
ENGINE=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
if [ ! -f "$ENGINE" ]; then
  fail "missing Linux Prisma query engine: $ENGINE"
else
  echo "  OK $ENGINE"
fi

echo "-- check no Windows Prisma engine leftovers --"
find /app -name "query_engine-windows.dll.node*" > /tmp/win_engines.txt 2>/dev/null || true
if [ -s /tmp/win_engines.txt ]; then
  fail "Windows Prisma engine files present in image:"
  cat /tmp/win_engines.txt >&2 || true
else
  echo "  OK no Windows engines"
fi

echo "-- require @prisma/client --"
if ! node -e "require(\"@prisma/client\"); console.log(\"  OK require(@prisma/client)\")"; then
  fail "require(\"@prisma/client\") failed"
fi

if [ "$failed" -ne 0 ]; then
  echo "==> Image FAILED verification: $VERIFY_IMAGE_LABEL" >&2
  exit 1
fi

echo "==> Image OK: $VERIFY_IMAGE_LABEL"
'
