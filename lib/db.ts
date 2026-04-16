import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'ofd.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    -- Firefighter roster
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_number TEXT,
      name TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      -- status: active | officer | retired | inactive | 50yr
      remarks TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Fixed weekly check assignment slots (Tower 21 A&E, Tower 21 SCBA, etc.)
    CREATE TABLE IF NOT EXISTS assignment_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apparatus_name TEXT NOT NULL,
      slot_type TEXT NOT NULL,
      rotation_note TEXT,
      -- JSON array of alternating labels, e.g. '["Officer","Driver"]'
      -- NULL means no rotation sub-label
      rotation_labels TEXT,
      oic_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- Monthly-ish periods (each column in the old tracking sheet)
    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,  -- First Monday (YYYY-MM-DD)
      week_count INTEGER NOT NULL DEFAULT 4,
      is_current INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Who is assigned to each slot for a given period
    CREATE TABLE IF NOT EXISTS period_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      slot_id INTEGER NOT NULL REFERENCES assignment_slots(id) ON DELETE CASCADE,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      UNIQUE(period_id, slot_id)
    );

    -- Per-week completion records (only inserted when marked complete)
    CREATE TABLE IF NOT EXISTS weekly_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES period_assignments(id) ON DELETE CASCADE,
      week_date TEXT NOT NULL,  -- The Monday (YYYY-MM-DD)
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_by TEXT,
      notes TEXT,
      UNIQUE(assignment_id, week_date)
    );

    -- Log of every reminder notification sent
    CREATE TABLE IF NOT EXISTS notification_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id     INTEGER REFERENCES members(id) ON DELETE SET NULL,
      assignment_id INTEGER REFERENCES period_assignments(id) ON DELETE SET NULL,
      week_date     TEXT NOT NULL,
      method        TEXT NOT NULL DEFAULT 'email',
      recipient     TEXT NOT NULL,
      status        TEXT NOT NULL,         -- 'sent' | 'failed'
      error_message TEXT,
      triggered_by  TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'cron'
      sent_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Log of each FirstDue sync run
    CREATE TABLE IF NOT EXISTS firstdue_sync_log (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at          TEXT NOT NULL DEFAULT (datetime('now')),
      completions_found  INTEGER NOT NULL DEFAULT 0,
      completions_new    INTEGER NOT NULL DEFAULT 0,
      errors             TEXT   -- JSON array of error strings, or NULL
    );
  `);

  // Add columns introduced after initial schema (idempotent guards)
  const slotCols = (db.prepare("PRAGMA table_info(assignment_slots)").all() as { name: string }[]).map(c => c.name);
  if (!slotCols.includes('firstdue_checklist_id')) {
    db.exec("ALTER TABLE assignment_slots ADD COLUMN firstdue_checklist_id TEXT");
  }
  const memberCols = (db.prepare("PRAGMA table_info(members)").all() as { name: string }[]).map(c => c.name);
  if (!memberCols.includes('firstdue_user_id')) {
    db.exec("ALTER TABLE members ADD COLUMN firstdue_user_id TEXT");
  }

  const count = (db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }).c;
  if (count === 0) seedData(db);
}

function seedData(db: Database.Database) {
  // ── Members from the Oradell FD tracking sheet ──────────────────────────
  const insertMember = db.prepare(`
    INSERT INTO members (line_number, name, email, status, remarks, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const members: [string, string, string, string, string, number][] = [
    ['33', 'J. Bonaglia',       'jbonaglia@oradellfire.org',     'active',  '',    1],
    ['34', 'S. Kufel',          'skufel@oradellfire.org',         '50yr',    '',    1],
    ['35', 'B. Tsagaratos',     'btsagarato@oradellfire.org',     'active',  '',    1],
    ['36', 'C. Harris',         'charris@oradellfire.org',        'active',  '',    1],
    ['37', 'N. Roux',           'nroux@oradellfire.org',          'active',  '',    1],
    ['38', 'S. Verducci',       'sverducci@oradellfire.org',      'active',  '',    1],
    ['40', 'RETIRED',           '',                               'retired', '',    0],
    ['41', 'C. May',            '',                               '50yr',    '',    1],
    ['42', 'W. Fricke',         'wfricke@oradellfire.org',        'active',  '',    1],
    ['43', 'J. Koth III',       'jkoth@oradellfire.org',          'active',  'P&A', 1],
    ['44', 'M. Zempol',         'mzempol@oradellfire.org',        'active',  '',    1],
    ['45', 'F. Gangemi',        'fgangemi@oradellfire.org',       'active',  'P&A', 1],
    ['46', 'S. Gencarelli',     'sgencarelli@oradellfire.org',    'active',  '',    1],
    ['48', 'R. Kwon',           'rkwon@oradellfire.org',          'active',  '',    1],
    ['49', 'D. Kahill',         'dkahill@oradellfire.org',        'active',  'P&A', 1],
    ['50', 'Lt. K. Burns',      'kburns@oradellfire.org',         'officer', '',    1],
    ['51', 'H. Pobutkiewicz',   'hpobutkiewicz@oradellfire.org',  'active',  '',    1],
    ['52', 'T. Kellerman',      'tkellerman@oradellfire.org',     'active',  '',    1],
    ['54', 'J. Kufel',          'jkufel@oradellfire.org',         'active',  '',    1],
    ['55', 'R. Larkin',         'rlarkin@oradellfire.org',        'active',  '',    1],
    ['56', 'A. Gianfrancesco',  'agianfrancesco@oradellfire.org', 'active',  '',    1],
    ['57', 'J. Pellechio',      'jpellechio@oradellfire.org',     'active',  '',    1],
    ['58', 'L. Bosetti',        'lbosetti@oradellfire.org',       'active',  '',    1],
    ['59', 'V. Parmar',         'vparmar@oradellfire.org',        'active',  '',    1],
    ['60', 'E. Mata',           'emata@oradellfire.org',          'active',  '',    1],
    ['61', 'D. Gonzalez',       'dgonzalez@oradellfire.org',      'active',  '',    1],
    ['',   'E. Pak',            'epak@oradellfire.org',           'active',  '',    1],
    ['',   'T. Murray',         'tmurray@oradellfire.org',        'active',  '',    1],
    ['',   'N. Pinto-Shaw',     'npintoshaw@oradellfire.org',     'active',  '',    1],
    ['',   'A. Burns',          'aburns@oradellfire.org',         'active',  '',    1],
    // Members currently assigned (may not appear in visible roster rows)
    ['',   'B. Bonte',          'bbonte@oradellfire.org',         'active',  '',    1],
    ['',   'J. DeStefano',      'jdestefano@oradellfire.org',     'active',  '',    1],
    ['',   'D. Schneider',      'dschneider@oradellfire.org',     'active',  '',    1],
    ['',   'J. Kaplan',         'jkaplan@oradellfire.org',        'active',  '',    1],
    ['62', 'NOT ASSIGNED',      'no-reply@oradellfire.org',       'inactive','',    0],
  ];
  for (const m of members) insertMember.run(...m);

  // ── Assignment slots ─────────────────────────────────────────────────────
  const insertSlot = db.prepare(`
    INSERT INTO assignment_slots
      (apparatus_name, slot_type, rotation_note, rotation_labels, oic_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // rotation_labels: JSON string or null
  insertSlot.run('Pumps & Aerial',          'Pumps & Aerial',        'Different Engine or Ladder Each Week',  null,                            'A/C Moretti',          1);
  insertSlot.run('Tower 21',                'Apparatus & Equipment', 'Alternate Sides Each Week',             '["Officer","Driver"]',           'Lt. Jaimes',           2);
  insertSlot.run('Tower 21',                'SCBA',                  null,                                    null,                            'Lt. Jaimes',           3);
  insertSlot.run('Squad 22',                'Apparatus & Equipment', 'Alternate Sides Each Week',             '["Driver","Officer"]',           'Capt. Bernard',        4);
  insertSlot.run('Squad 22',                'SCBA',                  null,                                    null,                            'Capt. Bernard',        5);
  insertSlot.run('Engine 23 & Engine 24',   'Apparatus & Equipment', 'Alternate Engine Each Week',            '["Engine 23","Engine 24"]',      'Lt. Haak / Lt. Burns', 6);
  insertSlot.run('Engine 23',               'SCBA',                  null,                                    null,                            'Lt. Haak / Lt. Burns', 7);
  insertSlot.run('Engine 24',               'SCBA',                  null,                                    null,                            'Lt. Haak / Lt. Burns', 8);

  // ── Current period: starts 2026-03-16 ───────────────────────────────────
  const periodResult = db.prepare(`
    INSERT INTO periods (name, start_date, week_count, is_current)
    VALUES ('March–April 2026', '2026-03-16', 5, 1)
  `).run();
  const periodId = periodResult.lastInsertRowid;

  // Member name → id lookup
  const memberByName = (name: string): number | null => {
    const row = db.prepare('SELECT id FROM members WHERE name = ?').get(name) as { id: number } | undefined;
    return row ? row.id : null;
  };

  // Assignments for current period (from the screenshot "This Month" column)
  const assignmentData: [number, string][] = [
    [1, 'J. Koth III'],
    [2, 'B. Bonte'],
    [3, 'N. Roux'],
    [4, 'J. DeStefano'],
    [5, 'M. Zempol'],
    [6, 'D. Schneider'],
    [7, 'J. Kaplan'],
    [8, 'R. Kwon'],
  ];

  const insertAssignment = db.prepare(`
    INSERT INTO period_assignments (period_id, slot_id, member_id) VALUES (?, ?, ?)
  `);

  for (const [slotOrder, memberName] of assignmentData) {
    const slot = db.prepare('SELECT id FROM assignment_slots WHERE sort_order = ?').get(slotOrder) as { id: number };
    const memberId = memberByName(memberName);
    if (slot) insertAssignment.run(periodId, slot.id, memberId);
  }
}
