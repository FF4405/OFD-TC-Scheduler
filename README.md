# OFD Equipment Scheduler

A Next.js web app for managing apparatus and equipment check assignments for the Oradell Fire Department.

## Quick Install (Ubuntu)

```bash
git clone <repo-url>
cd OFD
chmod +x install.sh
./install.sh
```

`install.sh` will:
1. Install Node.js if not present (via NodeSource or nvm)
2. Fix directory permissions
3. Create the `data/` folder for the SQLite database
4. Run `npm install`
5. Build the app with `npm run build`
6. Optionally install as a **systemd service** so it starts on boot

## Running the App

```bash
# Production (after install)
./start.sh

# Development (hot-reload)
./start.sh dev

# Custom port
PORT=8080 ./start.sh
```

## Manual Steps (if you prefer)

```bash
# Fix permissions first if npm install fails with EACCES
sudo chown -R $(whoami):$(whoami) .

npm install
npm run build
npm start          # production on http://localhost:3000
npm run dev        # development with hot-reload
```

## Systemd Service (run on boot)

If you chose the systemd option during install, manage it with:

```bash
sudo systemctl status ofd-scheduler
sudo systemctl stop ofd-scheduler
sudo systemctl start ofd-scheduler
sudo journalctl -u ofd-scheduler -f   # live logs
```

## Tech Stack

- **Next.js 16** – React framework with App Router
- **SQLite** (better-sqlite3) – local database stored at `data/ofd.db`
- **Tailwind CSS 4** – styling
- **TypeScript** – type safety
