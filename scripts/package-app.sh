#!/usr/bin/env bash
# Builds ShorterManager into distributable installers.
#
# Usage:
#   ./scripts/package-app.sh          # builds both macOS (.dmg/.app) and Windows (.exe)
#   ./scripts/package-app.sh mac      # macOS only
#   ./scripts/package-app.sh win      # Windows only
#
# Output lands in AppBuild/ at the repo root.

set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-all}"

case "$TARGET" in
  mac)
    npm run build:mac
    ;;
  win)
    npm run build:win
    ;;
  all)
    npm run build:mac
    npm run build:win
    ;;
  *)
    echo "Usage: $0 [mac|win|all]" >&2
    exit 1
    ;;
esac

echo ""
echo "Fichiers générés dans AppBuild/ :"
ls -la AppBuild/*.dmg AppBuild/*.exe AppBuild/mac*/*.app 2>/dev/null || true
