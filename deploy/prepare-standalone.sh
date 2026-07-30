#!/usr/bin/env bash
# Copy static/public into Next standalone output (required before docker image package).
# Also materialize Next traced hashed externals (e.g. jsdom-<hash>, @prisma/client-<hash>)
# that are symlinks/junctions to absolute build-machine paths and break inside Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve hashed package name for fallback copy from ROOT/node_modules.
# Examples:
#   .../jsdom-4cccfac9827ebcfe              -> jsdom
#   .../@prisma/client-2c3a283f134fdcb6    -> @prisma/client
hashed_link_to_pkg() {
  local link="$1"
  local name parent_base pkg_name
  name="$(basename "$link")"
  parent_base="$(basename "$(dirname "$link")")"
  pkg_name="$(echo "$name" | sed -E 's/-[a-f0-9]{8,}$//')"
  if [[ "$parent_base" == @* ]]; then
    echo "${parent_base}/${pkg_name}"
  else
    echo "$pkg_name"
  fi
}

materialize_traced_symlinks() {
  local standalone="$1"
  local link target pkg

  # -type l matches symlinks and Windows junctions under Git Bash / MSYS.
  while IFS= read -r -d '' link; do
    target="$(readlink "$link" || true)"
    rm -f "$link"

    if [ -n "${target:-}" ] && [ -e "$target" ]; then
      cp -aR "$target" "$link"
      echo "  Materialized: $(basename "$link") <- $target"
      continue
    fi

    pkg="$(hashed_link_to_pkg "$link")"
    if [ -d "$ROOT/node_modules/$pkg" ]; then
      cp -aR "$ROOT/node_modules/$pkg" "$link"
      echo "  Materialized from node_modules: $pkg -> $(basename "$link")"
      continue
    fi

    echo "ERROR: cannot resolve traced symlink: $link (target=${target:-none} pkg=$pkg)" >&2
    exit 1
  done < <(find "$standalone" -type l -print0 2>/dev/null)

  # Fail closed if anything is still a symlink (would break in Linux containers).
  local leftover
  leftover="$(find "$standalone" -type l 2>/dev/null | head -n 5 || true)"
  if [ -n "$leftover" ]; then
    echo "ERROR: leftover symlinks in standalone (will break in Docker):" >&2
    echo "$leftover" >&2
    exit 1
  fi
}

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

  materialize_traced_symlinks "$standalone"

  # Remove Windows query engine temp files to save image size
  find "$standalone" -name 'query_engine-windows.dll.node*' -delete 2>/dev/null || true

  echo "Prepared standalone: $app_name"
}

prepare_app "$ROOT/apps/tracking" "tracking"
prepare_app "$ROOT/apps/platform" "platform"
