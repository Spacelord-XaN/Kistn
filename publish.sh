#!/bin/sh
# Builds BoxGen and publishes the static site into a web server directory.
# Usage: ./publish.sh <target-dir> [base-path]
#   target-dir  directory your web server serves, e.g. /var/www/boxgen
#   base-path   URL path the app is served under (default /), e.g. /boxgen/
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <target-dir> [base-path]" >&2
  exit 1
fi

# Resolve the target against the caller's directory before changing into ours.
case "$1" in
  /*) TARGET="$1" ;;
  *) TARGET="$PWD/$1" ;;
esac
TARGET="${TARGET%/}"
BASE="${2:-/}"

if [ -z "$TARGET" ] || [ "$TARGET" = "${HOME%/}" ]; then
  echo "Refusing to publish into '${TARGET:-/}'." >&2
  exit 1
fi
# The old contents get replaced, so only touch empty dirs or previous publishes.
if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET")" ] && [ ! -f "$TARGET/index.html" ]; then
  echo "Refusing to publish into '$TARGET': it is not empty and has no index.html." >&2
  exit 1
fi

cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "$NVM_DIR/nvm.sh"
fi
[ -d node_modules ] || npm ci

npm test
npm run build -- --base "$BASE"

mkdir -p "$TARGET"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete dist/ "$TARGET/"
else
  find "$TARGET" -mindepth 1 -delete
  cp -R dist/. "$TARGET/"
fi

echo "Published to $TARGET (base path $BASE)"
