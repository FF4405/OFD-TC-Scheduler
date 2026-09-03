# Oradell Fire Department — TC Scheduler

Schedules the truck company's weekly apparatus & equipment checks, tracks who's completed
theirs, and reminds whoever hasn't by email.

Firefighters sign in with their email (a one-time code, no password), see the schedule grid,
and mark their own check complete. An admin manages the roster, the check slots, and
scheduling periods, and can auto-generate upcoming periods from a round-robin rotation.

## Stack

- **Framework**: Next.js (App Router, TypeScript), deployed to Cloudflare Workers via
  `@opennextjs/cloudflare`
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth**: Built-in email + one-time code (OTP) sign-in, with a 30-day D1-backed session — no
  Cloudflare Access / Zero Trust dependency
- **Email**: Mailgun HTTP API
- **UI**: Tailwind CSS, hand-rolled component primitives on top of Radix UI — same visual
  theme (brand gradient header, color tokens, dark mode) as the
  [OFD Driver Training](https://github.com/FF4405/ofd-driver-training) app

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in real values, see "Auth & email setup" below
npm run dev          # next dev server at http://localhost:3000
```

## Database

Migrations are plain SQL, generated from `src/db/schema.ts` with Drizzle Kit and applied with
Wrangler (not `drizzle-kit push`):

```bash
npx drizzle-kit generate                                                # after editing schema.ts
npx wrangler d1 execute ofd-tc-scheduler --local --file=./migrations/<file>.sql   # dev
npx wrangler d1 execute ofd-tc-scheduler --remote --file=./migrations/<file>.sql  # prod (needs `wrangler login`)
```

`db/seed.sql` seeds the truck company roster and the eight apparatus/equipment check slots the
same way (`--local`/`--remote`). Members are seeded as placeholders (already-trusted, no login
yet) — each one's first real sign-in with a matching email claims their row, keeping their
history. No demo scheduling period is seeded; create the first one from `/periods/new` or the
"Auto-generate periods" button on `/settings` after deploying.

## Auth & email setup

Sign-in is built into the app itself: enter your email, get a 6-digit code, enter the code —
no Cloudflare Access, no per-user Zero Trust seat, no password to remember. A signed-in session
lasts 30 days.

1. Sign up for [Mailgun](https://www.mailgun.com), verify a sending domain (adds an SPF/DKIM DNS
   record), and create an API key.
2. Set `ALLOWED_EMAIL_DOMAINS` to the domain(s) allowed to sign in at all — anything outside
   this list is rejected before a code is ever sent.
3. Fill in `.dev.vars` locally (see `.dev.vars.example` for the full list).
4. In production, `ALLOWED_EMAIL_DOMAINS`, `ADMIN_BOOTSTRAP_EMAILS`, `MAILGUN_DOMAIN`, and
   `MAILGUN_FROM` are non-secret and live directly in `wrangler.jsonc`'s `vars` block — edit
   them there and redeploy, don't add them as Cloudflare dashboard "Text" variables, since a
   `wrangler deploy` treats `wrangler.jsonc` as authoritative and will wipe any dashboard-only
   var not listed there. `MAILGUN_API_KEY` and `CRON_SECRET` are real credentials and stay out
   of the repo — set them with `wrangler secret put MAILGUN_API_KEY` / `wrangler secret put
   CRON_SECRET` (secrets survive deploys regardless of `wrangler.jsonc`).

First sign-in for any email listed in `ADMIN_BOOTSTRAP_EMAILS` becomes an active admin
automatically. Everyone else who signs in with an email not already on the seeded roster gets
in read-only until an admin approves them — see "Access requests" below. A member seeded from
`db/seed.sql` is already trusted and active the moment they claim their row by signing in.

**Local development**: `next dev`/`wrangler dev` send OTP codes the same way production does,
but if Mailgun isn't configured locally (or delivery fails) the code is printed to the server
console instead — look for `[dev] OTP code for ...`.

## Access requests

Anyone signing in with an email that isn't already on the seeded roster provisions inactive
(read-only) until an admin approves them. `/admin/access-requests` lists pending requests;
approving one activates the member and places them at the back of the rotation queue.
`/admin/users` controls sign-in access and admin rights directly; roster details (line #,
status, remarks) are edited from a member's profile under `/members`.

## Scheduling

- **Slots** (`/slots`, admin) — the rows of the schedule grid: one per apparatus/equipment
  check, with an OIC label and optional weekly rotation labels (e.g. "Officer"/"Driver"
  alternating).
- **Periods** (`/periods`, admin to create/edit) — a period runs from one 2nd-Monday-of-the-
  month to the next. `/periods/new` builds one manually, pre-populated from the current
  period's assignments; `/settings` → "Auto-generate periods" fills in upcoming periods
  automatically, carrying a poor-attendance member's slot forward and rotating everyone else
  from the queue.
- **Schedule** (`/`) — the grid itself. Any active member can click a week's cell to mark their
  check complete or undo it; an admin (or anyone, via the "Remind pending" button) can preview
  and send a reminder email for the current week.

## Reminders

A Cloudflare Cron Trigger fires the Worker's `scheduled` handler hourly; it checks the
configured reminder day/hour (`/settings`, in America/New_York time) and only actually sends
once that matches — so admins can retime the weekly reminder from the Settings page without a
redeploy, and it fires at most once per week (see `src/app/api/cron/remind/route.ts`).

## Tests

```bash
npm run test    # vitest
```

## Cloudflare Workers build/preview/deploy

```bash
npm run cf:build      # build the app for the Workers runtime
npm run cf:preview    # build + run locally under wrangler dev (Workers/Miniflare runtime)
npm run cf:deploy     # build + deploy to Cloudflare (requires `wrangler login` or a CLOUDFLARE_API_TOKEN)
npm run cf:typegen    # regenerate cloudflare-env.d.ts from wrangler.jsonc bindings
```

The `ofd-tc-scheduler` D1 database and Worker are already provisioned in the Cloudflare
account; `wrangler.jsonc` points at that database. Before the first deploy:

1. `wrangler login` (or set `CLOUDFLARE_API_TOKEN`).
2. `wrangler secret put MAILGUN_API_KEY` and `wrangler secret put CRON_SECRET`.
3. Apply migrations and seed data to the remote database (`--remote`, see "Database" above).
4. `npm run cf:deploy`.
5. Update `next.config.ts`'s `experimental.serverActions.allowedOrigins` and
   `wrangler.jsonc`'s `vars` (email domains, admin bootstrap email, Mailgun domain/from) for
   the actual deployed domain before going live.

## Project status

Ported from the original Express/EJS/SQLite version of this app (which couldn't run on
Cloudflare — `better-sqlite3` is a native binary) onto the same stack and visual theme as
[OFD Driver Training](https://github.com/FF4405/ofd-driver-training): D1 + Drizzle, built-in
OTP auth, Tailwind theme, Cloudflare Cron Trigger for reminders. All original functionality is
carried over: schedule grid with click-to-complete, member roster with rotation queue, slot and
period management, auto-generated rotation with repeat/graduate logic, manual and automated
email reminders, and per-member assignment/notification history.

Remaining before day-to-day use:

- Deploy: `npm run cf:deploy` (see "Cloudflare Workers build/preview/deploy" above).
- Seed the roster and slots on the remote database (`db/seed.sql`, `--remote`).
- Create the first scheduling period from `/periods/new`, or set a rotation via
  `/settings` → "Auto-generate periods".
