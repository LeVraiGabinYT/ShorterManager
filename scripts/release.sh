#!/usr/bin/env bash
# Bumps the app version, builds the Mac and Windows installers, and publishes them
# to GitHub Releases — every already-installed copy of the app then picks up the
# new version automatically via the in-app update checker.
#
# Requires a GH_TOKEN environment variable: a GitHub personal access token with
# write access to this repo's releases (classic token with the "repo" scope, or a
# fine-grained token scoped to this repo with "Contents: Read and write").
#
# Usage:
#   GH_TOKEN=ghp_xxx ./scripts/release.sh          # patch bump: 1.0.0 -> 1.0.1
#   GH_TOKEN=ghp_xxx ./scripts/release.sh minor     # 1.0.0 -> 1.1.0
#   GH_TOKEN=ghp_xxx ./scripts/release.sh major     # 1.0.0 -> 2.0.0

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${GH_TOKEN:-}" ]; then
  echo "Erreur : la variable GH_TOKEN doit être définie (token GitHub avec accès en écriture aux releases)." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Erreur : des changements non commités existent. Commit ou stash d'abord." >&2
  exit 1
fi

BUMP="${1:-patch}"

npm version "$BUMP" -m "Release v%s"
VERSION=$(node -p "require('./package.json').version")
echo "Nouvelle version : $VERSION"

npm run build:mac -- --publish always
npm run build:win -- --publish always

git push
git push --tags

echo ""
echo "Version $VERSION publiée sur GitHub Releases — les installations existantes la détecteront automatiquement."
