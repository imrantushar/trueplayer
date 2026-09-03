#!/bin/bash
set -euo pipefail

echo "🚀 Starting WP dist build..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Derive the version from the plugin's main file so the archive is named
# e.g. zenappbuilder.1.2.0.zip. Not using `wp dist-archive`'s own built-in
# version auto-discovery (--filename-format default "{name}.{version}")
# because that only recognizes /** */ PHPDoc-style docblocks (it filters on
# PHP's T_DOC_COMMENT token) — this plugin's header is a plain /* */ comment,
# so it's silently undetectable to that mechanism and falls back to an
# unversioned name. composer.json has no "version" field either.
PLUGIN_SLUG="$(basename "$REPO_ROOT")"
PLUGIN_MAIN_FILE="$REPO_ROOT/$PLUGIN_SLUG.php"
VERSION=""
if [ -f "$PLUGIN_MAIN_FILE" ]; then
  VERSION="$(grep -m1 -E '^[[:space:]]*\*?[[:space:]]*Version:' "$PLUGIN_MAIN_FILE" \
    | sed -E 's/.*Version:[[:space:]]*([0-9][0-9A-Za-z.+-]*).*/\1/')"
fi

# Safety check
if [ ! -f ".distignore" ]; then
  echo "❌ .distignore not found in repo root"
  exit 1
fi

# update this array based on your movable folders
HEAVY_DIRS=(
  "node_modules"
  "dev_trueplayer"
  "addons"
)

BACKUP_DIR="$(mktemp -d /tmp/wp-dist-backup-XXXXXX)"

# Track whether we stripped dev dependencies so the restore step knows to
# reinstall them. The StoreEngine license SDK now ships from vendor/, so the
# archive must include a production-only vendor/ (no phpcs/phpunit/etc.).
STRIPPED_DEV_DEPS=0

# Restore function (always runs)
restore() {
  echo "♻️ Restoring heavy folders..."

  for dir in "${HEAVY_DIRS[@]}"; do
    if [ -d "$BACKUP_DIR/$dir" ]; then
      echo "Restoring $dir"
      if ! mv "$BACKUP_DIR/$dir" "$REPO_ROOT/"; then
        echo "Failed to restore $dir"
        exit 1
      fi
    else
      echo "Not found: $BACKUP_DIR/$dir"
    fi
  done

  # Reinstall dev dependencies that were stripped for the production archive.
  if [ "$STRIPPED_DEV_DEPS" -eq 1 ] && command -v composer >/dev/null 2>&1; then
    echo "♻️ Reinstalling dev dependencies (composer install)..."
    composer install --optimize-autoloader --no-interaction || \
      echo "⚠️ Failed to reinstall dev dependencies — run 'composer install' manually"
  fi

  rm -rf "$BACKUP_DIR"
  echo "✅ Restore complete"
}

# Ensure restore ALWAYS runs (success, failure, crash, Ctrl+C)
trap 'restore' EXIT INT TERM

# Build a production-only vendor/ so the StoreEngine SDK ships without the
# dev tooling (phpcs, phpunit, …). Dev deps are reinstalled in restore().
if command -v composer >/dev/null 2>&1; then
  echo "📦 Installing production Composer dependencies (--no-dev)..."
  STRIPPED_DEV_DEPS=1
  composer install --no-dev --optimize-autoloader --no-interaction
else
  echo "⚠️ composer not found — archiving vendor/ as-is (may include dev dependencies)"
fi

# Move heavy folders away
echo "📦 Moving heavy folders to temp location..."

for dir in "${HEAVY_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "➡️ Moving $dir"

    if [ -z "$dir" ] || [ "${dir#/}" != "$dir" ] || [[ "$dir" == *".."* ]]; then
      echo "Refusing to move unexpected path: $dir"
      exit 1
    fi

    # try fast move first
    if ! mv "$dir" "$BACKUP_DIR/"; then
      echo "⚠️ mv failed for $dir, using copy+remove fallback"

      if ! cp -a "$dir" "$BACKUP_DIR/"; then
        echo "Failed to copy $dir to backup"
        exit 1
      fi

      if ! rm -rf "$dir"; then
        echo "Failed to remove original $dir after backup copy"
        exit 1
      fi
    fi
  fi
done

# Run WP packaging
echo "📦 Running WP dist-archive..."

if [ -n "$VERSION" ]; then
  TARGET="$REPO_ROOT/../$PLUGIN_SLUG.$VERSION.zip"
  echo "📌 Version detected: $VERSION → $(basename "$TARGET")"
  wp dist-archive . "$TARGET" --force
else
  echo "⚠️ Could not detect plugin version from $PLUGIN_SLUG.php — falling back to unversioned filename"
  wp dist-archive . --force
fi

echo "🎉 Build completed successfully"