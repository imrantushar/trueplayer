#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PLUGIN_DIR"

PLUGIN_FILE="trueplayer.php"
LANGUAGES_DIR="languages"
POT_FILE="$LANGUAGES_DIR/trueplayer.pot"

echo "🌐 Generating POT file..."

if ! command -v wp &>/dev/null; then
  echo "❌ WP-CLI not found. Install it: https://wp-cli.org/#installing"
  exit 1
fi

if [ ! -f "$PLUGIN_FILE" ]; then
  echo "❌ Plugin file not found: $PLUGIN_FILE"
  exit 1
fi

mkdir -p "$LANGUAGES_DIR"

TEXT_DOMAIN=$(grep -m1 "Text Domain:" "$PLUGIN_FILE" | sed 's/.*Text Domain:[[:space:]]*//' | tr -d '[:space:]\r')
VERSION=$(grep -m1 "^ \* Version:" "$PLUGIN_FILE" | sed 's/.*Version:[[:space:]]*//' | tr -d '[:space:]\r')

if [ -z "$TEXT_DOMAIN" ]; then
  echo "❌ Could not read Text Domain from $PLUGIN_FILE"
  exit 1
fi

echo "   Plugin : $(grep -m1 'Plugin Name:' "$PLUGIN_FILE" | sed 's/.*Plugin Name:[[:space:]]*//' | tr -d '\r')"
echo "   Domain : $TEXT_DOMAIN"
echo "   Version: $VERSION"
echo "   Output : $POT_FILE"
echo ""

# --ignore-domain (not --domain): dev_trueplayer/utils/translation.js wraps
# @wordpress/i18n so every call site only passes the string, e.g. __('text')
# — the 'trueplayer' domain is injected inside the wrapper, never as a
# literal at the call site. --domain=trueplayer requires that literal to be
# present and match, so every wrapped call was silently skipped; --ignore-domain
# extracts __/_n/_x/_nx calls regardless, which is what actually appears in
# the compiled JS. PHP calls (which do pass 'trueplayer' explicitly) still
# get extracted the same either way.
wp i18n make-pot . "$POT_FILE" \
  --ignore-domain \
  --exclude="dev_trueplayer/,node_modules/,vendor/,scripts/,.git/,docs/,build-tools/"

echo ""
echo "✅ POT file generated: $POT_FILE"
