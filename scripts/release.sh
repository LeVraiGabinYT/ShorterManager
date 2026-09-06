#!/usr/bin/env bash
# Bumps the app version, builds the Mac and Windows installers, and publishes them
# to GitHub Releases — every already-installed copy of the app then picks up the
# new version automatically via the in-app update checker. Release notes are set on
# the GitHub Release itself, which is also where the in-app "Notes de version"
# screen (Paramètres) reads them from — so every release must carry notes, no
# exceptions.
#
# Requires:
#   - a GH_TOKEN environment variable: a GitHub personal access token with write
#     access to this repo's releases (classic token with the "repo" scope, or a
#     fine-grained token scoped to this repo with "Contents: Read and write")
#   - the GitHub CLI (`gh`) on PATH, to attach the release notes after publish
#
# Usage:
#   GH_TOKEN=ghp_xxx ./scripts/release.sh patch "Notes de version"      # 1.0.0 -> 1.0.1
#   GH_TOKEN=ghp_xxx ./scripts/release.sh minor "Notes de version"      # 1.0.0 -> 1.1.0
#   GH_TOKEN=ghp_xxx ./scripts/release.sh major "Notes de version"      # 1.0.0 -> 2.0.0

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${GH_TOKEN:-}" ]; then
  echo "Erreur : la variable GH_TOKEN doit être définie (token GitHub avec accès en écriture aux releases)." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Erreur : la CLI GitHub (gh) est requise pour attacher les notes de version." >&2
  exit 1
fi

BUMP="${1:-patch}"
NOTES="${2:-}"

if [ -z "$NOTES" ]; then
  echo "Erreur : des notes de version sont requises en 2e argument." >&2
  echo "Usage : GH_TOKEN=ghp_xxx ./scripts/release.sh [patch|minor|major] \"Notes de version\"" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Erreur : des changements non commités existent. Commit ou stash d'abord." >&2
  exit 1
fi

npm version "$BUMP" -m "Release v%s"
VERSION=$(node -p "require('./package.json').version")
echo "Nouvelle version : $VERSION"

npm run build:mac -- --publish always
npm run build:win -- --publish always

git push
git push --tags

echo "Attache des notes de version à la release GitHub..."
gh release edit "v$VERSION" --notes "$NOTES"

echo ""
echo "Version $VERSION publiée sur GitHub Releases — les installations existantes la détecteront automatiquement."
