#!/usr/bin/env bash
# Copy static/public into Next standalone output (required before docker image package).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

prepare_app() {
  local app_dir="$1"
  local app_name="$2"
  local standalone="$app_dir/.next/standalone"

  if [ ! -f "$app_dir/.next/BUILD_ID" ]; then
    echo "Missing build for $app_name — run npm run build:production first"
    exit 1
  fi

  if [ ! -d "$standalone" ]; then
    echo "No standalone output for $app_name (check output: \"standalone\" in next.config)"
    exit 1
  fi

  mkdir -p "$standalone/apps/$app_name/.next"
  rm -rf "$standalone/apps/$app_name/.next/static"
  cp -R "$app_dir/.next/static" "$standalone/apps/$app_name/.next/static"
  if [ -d "$app_dir/public" ]; then
    rm -rf "$standalone/apps/$app_name/public"
    cp -R "$app_dir/public" "$standalone/apps/$app_name/public"
  else
    mkdir -p "$standalone/apps/$app_name/public"
  fi

  # Fix broken symlinks for @prisma/client-* (Next traces them as symlinks
  # pointing to the build machine's absolute path, which won't exist in Docker).
  find "$standalone" -type l -path '*/@prisma/client-*' | while read -r link; do
    target="$(readlink "$link")"
    rm "$link"
    if [ -d "$target" ]; then
      cp -R "$target" "$link"
    else
      # Symlink target doesn't exist (cross-platform build); copy from root node_modules
      cp -R "$ROOT/node_modules/@prisma/client" "$link"
    fi
    echo "  Fixed prisma symlink: $(basename "$link")"
  done

  # Remove Windows query engine temp files to save ~400MB
  find "$standalone" -name 'query_engine-windows.dll.node*' -delete 2>/dev/null || true

  echo "Prepared standalone: $app_name"
}

prepare_app "$ROOT/apps/tracking" "tracking"
prepare_app "$ROOT/apps/platform" "platform"
