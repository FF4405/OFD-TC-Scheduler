#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
MODE="${1:-production}"

# Load nvm if node isn't on PATH
if ! command -v node &>/dev/null; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
fi

cd "$APP_DIR"

if [ "$MODE" = "dev" ]; then
  echo "Starting in development mode on http://localhost:$PORT"
  PORT=$PORT npm run dev
else
  if [ ! -d "$APP_DIR/.next" ]; then
    echo "No build found. Run ./install.sh first, or: npm run build"
    exit 1
  fi
  echo "Starting in production mode on http://localhost:$PORT"
  PORT=$PORT npm start
fi
