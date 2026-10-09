#!/bin/sh
# Starts the Kistn dev server. Loads nvm if node isn't already on PATH.
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "$NVM_DIR/nvm.sh"
fi
[ -d node_modules ] || npm install
exec npm run dev -- --open "$@"
