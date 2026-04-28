#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_MIN_VERSION=18

echo "=== OFD Equipment Scheduler – Install ==="
echo "App directory: $APP_DIR"

# ── 1. Ensure Node.js is available ────────────────────────────────────────────
install_node_via_nvm() {
  echo "Installing Node.js via nvm..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]))" 2>/dev/null; echo $?)
  # Better version check
  NODE_MAJOR=$(node -e "console.log(parseInt(process.versions.node.split('.')[0]))")
  if [ "$NODE_MAJOR" -lt "$NODE_MIN_VERSION" ]; then
    echo "Node.js $NODE_MAJOR found but v$NODE_MIN_VERSION+ required."
    install_node_via_nvm
  else
    echo "Node.js v$(node --version) found."
  fi
else
  echo "Node.js not found."
  # Try apt first (Ubuntu)
  if command -v apt-get &>/dev/null; then
    echo "Installing Node.js via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    install_node_via_nvm
  fi
fi

# ── 2. Fix ownership of the app directory ─────────────────────────────────────
echo "Fixing directory permissions..."
CURRENT_USER="${SUDO_USER:-$(whoami)}"
sudo chown -R "$CURRENT_USER":"$CURRENT_USER" "$APP_DIR"

# ── 3. Create data directory for SQLite ───────────────────────────────────────
mkdir -p "$APP_DIR/data"

# ── 4. Ensure enough memory (create swap if needed) ───────────────────────────
TOTAL_MEM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {printf "%d", $2/1024}' /proc/meminfo)
AVAILABLE_MB=$((TOTAL_MEM_MB + SWAP_MB))

if [ "$AVAILABLE_MB" -lt 1024 ]; then
  echo "Low memory detected (${TOTAL_MEM_MB} MB RAM, ${SWAP_MB} MB swap)."
  if [ "$SWAP_MB" -eq 0 ]; then
    echo "Creating 1 GB swap file at /swapfile..."
    sudo fallocate -l 1G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "Swap enabled."
  else
    echo "Existing swap in use; proceeding."
  fi
fi

# ── 5. Install npm dependencies ───────────────────────────────────────────────
echo "Installing npm dependencies..."
cd "$APP_DIR"
NODE_OPTIONS="--max-old-space-size=512" npm install

# ── 6. Optional: install as a systemd service ─────────────────────────────────
read -rp "Install as a systemd service to run on boot? [y/N] " INSTALL_SERVICE
if [[ "${INSTALL_SERVICE,,}" == "y" ]]; then
  PORT="${PORT:-3000}"
  SERVICE_FILE="/etc/systemd/system/ofd-scheduler.service"

  sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=OFD Equipment Scheduler
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable ofd-scheduler
  sudo systemctl start ofd-scheduler
  echo ""
  echo "Service installed and started."
  echo "  Status : sudo systemctl status ofd-scheduler"
  echo "  Logs   : sudo journalctl -u ofd-scheduler -f"
  echo "  Stop   : sudo systemctl stop ofd-scheduler"
  echo ""
  echo "App is running at http://localhost:$PORT"
else
  echo ""
  echo "=== Installation complete ==="
  echo "Run the app with:  ./start.sh"
  echo "  or manually:     node server.js"
fi
