#!/bin/bash
# Cloud sessions (Claude Code on the web): Node 24 (package.json engines) and npm dependencies,
# so tests, lint, typecheck and build run. The image ships Node 22; nvm lives in /opt/nvm.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export NVM_DIR="${NVM_DIR:-/opt/nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 24 >/dev/null
nvm use 24 >/dev/null

# Keep Node 24 first on PATH for the rest of the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$(dirname "$(nvm which 24)"):\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install (not ci) reuses node_modules from the cached container.
npm install --no-audit --no-fund
