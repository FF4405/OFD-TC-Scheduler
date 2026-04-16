# Oradell Fire Department — TC Scheduler

Web app for managing apparatus and equipment check assignments, email reminders, and FirstDue sync for the Oradell Fire Department.

---

## Features

- **Schedule grid** — assign firefighters to apparatus checks for 4–5 week periods
- **Weekly completion tracking** — click to mark checks done; overdue cells highlight red
- **Email reminders via Mailgun** — send manually from the dashboard or automatically every Monday morning
- **FirstDue sync** — hourly poll auto-marks completions pulled from FirstDue
- **Member history** — per-firefighter page showing all assignments, completion rates, and notification log

---

## Windows Server Installation

### Step 1 — Install prerequisites

Install all three of the following before continuing. Each has a standard Windows installer.

| Software | Where to get it | Notes |
|----------|----------------|-------|
| **Node.js 20 LTS** | https://nodejs.org/ | Choose the LTS installer |
| **Python 3.x** | https://python.org/downloads/ | Check "Add Python to PATH" during install |
| **Visual Studio Build Tools** | https://visualstudio.microsoft.com/downloads/ → *Tools for Visual Studio* → *Build Tools* | Select the **"Desktop development with C++"** workload |

> Python and Visual Studio Build Tools are required to compile `better-sqlite3` (the database driver). The app will fail to install without them.

Verify Node.js installed correctly by opening PowerShell and running:

```powershell
node --version   # should print v20.x.x or higher
npm --version
```

---

### Step 2 — Get the code

```powershell
git clone https://github.com/FF4405/OFD-TC-Scheduler.git
cd OFD-TC-Scheduler
```

---

### Step 3 — Configure environment variables

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Fill in the following values (the file has comments explaining each one):

```
NOTIFY_CRON_SECRET=<any long random string — e.g. 32+ random characters>

MAILGUN_API_KEY=<from app.mailgun.com → API Keys>
MAILGUN_DOMAIN=<your Mailgun sending domain>
MAILGUN_FROM=OFD Checks <checks@mg.yourdomain.com>

FIRSTDUE_API_KEY=<from your FirstDue department admin>
FIRSTDUE_BASE_URL=https://api.firstdue.com
```

> `NOTIFY_CRON_SECRET` protects the automated reminder endpoints. Set it to any random string — it just needs to match between `.env.local` and the Task Scheduler tasks (the installer handles this automatically).

Save and close the file.

---

### Step 4 — Run the installer

Open PowerShell **as Administrator** (right-click → *Run as administrator*), then:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
cd C:\path\to\OFD-TC-Scheduler
.\install-service.ps1
```

The installer will:

1. Check prerequisites and warn if anything is missing
2. Run `npm install` and `npm run build`
3. Install **PM2** globally and start the app
4. Register PM2 as a **Windows service** (auto-starts on reboot)
5. Create two **Windows Task Scheduler** tasks:
   - **OFD Monday Reminder** — fires every Monday at 8:00 AM, emails anyone who hasn't completed their check
   - **OFD FirstDue Sync** — fires every hour, pulls completions from FirstDue and marks them in the tracker

When complete, the installer prints the app URL and next steps.

---

### Step 5 — Open the app

Navigate to `http://localhost:3000` (or whatever `BASE_URL` you set in `.env.local`).

You should see the House Committee Assignments schedule grid.

---

### Step 6 — Connect FirstDue

This is a one-time setup after the app is running.

**Map apparatus to FirstDue checklists:**

1. Go to **Slots** in the top nav
2. Click the edit icon on each apparatus row
3. Enter the **FirstDue Checklist ID** for that apparatus (get these from your FirstDue admin or the FirstDue web portal)
4. Save

**Map firefighters to FirstDue users:**

1. Go to **Members** in the top nav
2. Click the history icon (clock) on each member row
3. Note the member's **FirstDue User ID** and enter it on their profile (get these from FirstDue)

Once both are set, the hourly sync will automatically mark checks as complete when they're recorded in FirstDue.

---

### Step 7 — Verify everything works

**Test the Monday reminder manually:**

```powershell
Start-ScheduledTask -TaskName "OFD Monday Reminder"
```

Check the notification log by clicking the history icon on any member who should have received an email.

**Test the FirstDue sync manually:**

```powershell
Start-ScheduledTask -TaskName "OFD FirstDue Sync"
```

The dashboard will show "FirstDue synced just now" in the period date bar if configured correctly.

**Check PM2 status:**

```powershell
pm2 status
pm2 logs ofd-scheduler    # live log tail
```

---

## Day-to-Day Operations

### Managing the service

```powershell
pm2 status                        # check if app is running
pm2 restart ofd-scheduler         # restart after config changes
pm2 stop ofd-scheduler            # stop the app
pm2 start ecosystem.config.js     # start after a manual stop
pm2 logs ofd-scheduler            # view recent logs
```

Logs are also written to `logs/out.log` and `logs/error.log` in the app folder.

### Creating a new period

1. Go to **Schedule** → click **New Period**
2. Select the start date (auto-populated to the 2nd Monday of the month)
3. Assign each firefighter to their apparatus slot
4. Save — the grid for the new period is immediately live

### Sending manual reminders

1. On the **Schedule** page, click **Remind X pending** (visible when there are incomplete checks for the current week)
2. Review the list of pending members
3. Click **Send Emails** — Mailgun delivers immediately and logs each result

### Viewing member history

Click the clock icon on any row in the **Members** page to see that firefighter's full assignment history, per-week completion record, and notification log.

---

## Changing the reminder time

The Monday reminder defaults to **8:00 AM**. To change it:

1. Open **Task Scheduler** (`taskschd.msc`)
2. Find **OFD Monday Reminder**
3. Right-click → Properties → Triggers → Edit
4. Change the time and save

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | SQLite via `better-sqlite3` — stored at `data/ofd.db` |
| Styling | Tailwind CSS 4 |
| Language | TypeScript |
| Email | Mailgun HTTP API (`mailgun.js`) |
| Process manager | PM2 |
| Scheduling | Windows Task Scheduler |
