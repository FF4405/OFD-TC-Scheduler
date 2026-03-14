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
    CREATE TABLE IF NOT EXISTS apparatus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      unit_number TEXT NOT NULL UNIQUE,
      year INTEGER,
      make TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS check_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apparatus_id INTEGER NOT NULL REFERENCES apparatus(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      apparatus_id INTEGER NOT NULL REFERENCES apparatus(id) ON DELETE CASCADE,
      assigned_to TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(week_start, apparatus_id)
    );

    CREATE TABLE IF NOT EXISTS check_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
      check_item_id INTEGER NOT NULL REFERENCES check_items(id) ON DELETE CASCADE,
      result TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      checked_at TEXT,
      checked_by TEXT
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apparatus_id INTEGER NOT NULL REFERENCES apparatus(id) ON DELETE CASCADE,
      schedule_id INTEGER,
      check_item_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL DEFAULT 'open',
      reported_by TEXT,
      reported_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT
    );
  `);

  // Seed data if apparatus table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM apparatus').get() as { c: number }).c;
  if (count === 0) {
    seedData(db);
  }
}

function seedData(db: Database.Database) {
  const insertApparatus = db.prepare(`
    INSERT INTO apparatus (name, type, unit_number, year, make, model, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO check_items (apparatus_id, category, name, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const apparatus = [
    { name: 'Engine 1', type: 'Engine', unit: 'E-1', year: 2019, make: 'Pierce', model: 'Enforcer' },
    { name: 'Engine 2', type: 'Engine', unit: 'E-2', year: 2015, make: 'Ferrara', model: 'Ignitor' },
    { name: 'Ladder 1', type: 'Ladder', unit: 'L-1', year: 2020, make: 'Pierce', model: 'Velocity' },
    { name: 'Rescue 1', type: 'Rescue', unit: 'R-1', year: 2018, make: 'Spartan', model: 'Metro Star' },
    { name: 'Tanker 1', type: 'Tanker', unit: 'T-1', year: 2016, make: 'Freightliner', model: 'Custom' },
    { name: 'Command 1', type: 'Command', unit: 'C-1', year: 2022, make: 'Ford', model: 'F-450' },
  ];

  const engineItems = [
    ['Cab & Controls', 'Fuel Level', 'Check fuel level, minimum 3/4 tank', 1],
    ['Cab & Controls', 'Oil Level', 'Check engine oil level', 2],
    ['Cab & Controls', 'Coolant Level', 'Check coolant level', 3],
    ['Cab & Controls', 'Warning Lights', 'Test all warning lights and signals', 4],
    ['Cab & Controls', 'Air Brakes', 'Test air brake system', 5],
    ['Cab & Controls', 'Wipers & Mirrors', 'Check wipers, mirrors, and glass', 6],
    ['Pump & Water', 'Pump Operation', 'Test pump panel operation', 7],
    ['Pump & Water', 'Water Tank Level', 'Verify water tank is full (500+ gal)', 8],
    ['Pump & Water', 'Foam System', 'Check foam supply and system', 9],
    ['Pump & Water', 'Discharge Caps', 'Inspect all discharge caps and valves', 10],
    ['Hose & Equipment', '1.75" Attack Hose', 'Verify hose load and couplings', 11],
    ['Hose & Equipment', '2.5" Supply Hose', 'Verify supply hose load', 12],
    ['Hose & Equipment', 'Nozzles', 'Inspect all nozzles and applicators', 13],
    ['Hose & Equipment', 'Ground Ladders', 'Inspect ground ladders', 14],
    ['SCBA', 'SCBA Units', 'Check all SCBA cylinders (full pressure)', 15],
    ['SCBA', 'SCBA Masks', 'Inspect masks and seals', 16],
    ['SCBA', 'Spare Cylinders', 'Verify spare cylinder count and pressure', 17],
    ['Medical', 'AED', 'Check AED battery and pads', 18],
    ['Medical', 'First Aid Kit', 'Inspect first aid kit supplies', 19],
    ['Medical', 'Oxygen', 'Check O2 cylinder levels', 20],
    ['Tools', 'Hand Tools', 'Inspect hand tools (axe, Halligan, etc.)', 21],
    ['Tools', 'Power Tools', 'Check power tools and fuel', 22],
    ['Tools', 'Salvage Equipment', 'Inspect salvage covers and equipment', 23],
    ['Exterior', 'Tires', 'Check all tire condition and pressure', 24],
    ['Exterior', 'Body & Compartments', 'Inspect body damage and compartment doors', 25],
    ['Exterior', 'Lights', 'Test all exterior lights and scene lights', 26],
  ];

  const ladderItems = [
    ['Cab & Controls', 'Fuel Level', 'Check fuel level, minimum 3/4 tank', 1],
    ['Cab & Controls', 'Oil Level', 'Check engine oil level', 2],
    ['Cab & Controls', 'Coolant Level', 'Check coolant level', 3],
    ['Cab & Controls', 'Warning Lights', 'Test all warning lights', 4],
    ['Cab & Controls', 'Air Brakes', 'Test air brake system', 5],
    ['Aerial Device', 'Aerial Ladder', 'Inspect aerial ladder rungs and structure', 6],
    ['Aerial Device', 'Aerial Controls', 'Test aerial controls at turntable', 7],
    ['Aerial Device', 'Outriggers', 'Test outrigger deployment', 8],
    ['Aerial Device', 'Hydraulic System', 'Check hydraulic fluid levels and lines', 9],
    ['Aerial Device', 'Aerial Lights', 'Test aerial tip and waterway lights', 10],
    ['Ground Ladders', '35ft Extension', 'Inspect 35ft extension ladder', 11],
    ['Ground Ladders', '24ft Extension', 'Inspect 24ft extension ladder', 12],
    ['Ground Ladders', 'Roof Ladder', 'Inspect roof ladder', 13],
    ['Ground Ladders', 'Attic Ladder', 'Inspect attic ladder', 14],
    ['SCBA', 'SCBA Units', 'Check all SCBA cylinders (full pressure)', 15],
    ['SCBA', 'SCBA Masks', 'Inspect masks and seals', 16],
    ['Tools', 'Ventilation Fans', 'Check PPV fans and blades', 17],
    ['Tools', 'Saws', 'Check chainsaws and rotary saws fuel/condition', 18],
    ['Tools', 'Hand Tools', 'Inspect forcible entry tools', 19],
    ['Medical', 'AED', 'Check AED battery and pads', 20],
    ['Exterior', 'Tires', 'Check all tire condition and pressure', 21],
    ['Exterior', 'Body & Compartments', 'Inspect body and compartment doors', 22],
    ['Exterior', 'Lights', 'Test all exterior and scene lights', 23],
  ];

  const rescueItems = [
    ['Cab & Controls', 'Fuel Level', 'Check fuel level, minimum 3/4 tank', 1],
    ['Cab & Controls', 'Oil Level', 'Check engine oil level', 2],
    ['Cab & Controls', 'Warning Lights', 'Test all warning lights', 3],
    ['Extrication', 'Hydraulic Tools', 'Check spreaders, cutters, rams', 4],
    ['Extrication', 'Hydraulic Fluid', 'Check hydraulic power unit fluid', 5],
    ['Extrication', 'Struts & Cribbing', 'Inspect vehicle stabilization equipment', 6],
    ['Extrication', 'Hand Tools', 'Inspect rescue hand tools', 7],
    ['Medical', 'Stretcher', 'Inspect stretcher and straps', 8],
    ['Medical', 'AED', 'Check AED battery and pads', 9],
    ['Medical', 'Oxygen', 'Check O2 cylinders and equipment', 10],
    ['Medical', 'Trauma Kits', 'Inspect trauma kits and supplies', 11],
    ['SCBA', 'SCBA Units', 'Check all SCBA cylinders', 12],
    ['Rope Rescue', 'Rope', 'Inspect all rescue rope', 13],
    ['Rope Rescue', 'Rigging Hardware', 'Inspect pulleys, carabiners, anchors', 14],
    ['Rope Rescue', 'Harnesses', 'Inspect all harnesses', 15],
    ['Confined Space', 'Gas Monitor', 'Test gas monitor and sensors', 16],
    ['Confined Space', 'Air Supply', 'Check confined space air supply', 17],
    ['Lighting', 'Generator', 'Start and test generator', 18],
    ['Lighting', 'Scene Lights', 'Test all scene lighting', 19],
    ['Exterior', 'Tires', 'Check all tire condition and pressure', 20],
    ['Exterior', 'Body & Compartments', 'Inspect body and compartment doors', 21],
  ];

  const tankerItems = [
    ['Cab & Controls', 'Fuel Level', 'Check fuel level, minimum 3/4 tank', 1],
    ['Cab & Controls', 'Oil Level', 'Check engine oil level', 2],
    ['Cab & Controls', 'Warning Lights', 'Test all warning lights', 3],
    ['Cab & Controls', 'Air Brakes', 'Test air brake system', 4],
    ['Tank & Pump', 'Water Tank Level', 'Verify water tank is full (2500+ gal)', 5],
    ['Tank & Pump', 'Pump Operation', 'Test pump operation', 6],
    ['Tank & Pump', 'Fill Site Equipment', 'Inspect fill site connections', 7],
    ['Tank & Pump', 'Dump Valves', 'Test all dump valves', 8],
    ['Hose', 'Supply Hose', 'Inspect supply hose', 9],
    ['Hose', 'Hard Suction', 'Inspect hard suction hose', 10],
    ['Exterior', 'Tires', 'Check all tire condition and pressure', 11],
    ['Exterior', 'Body & Compartments', 'Inspect body and compartment doors', 12],
    ['Exterior', 'Lights', 'Test all exterior lights', 13],
  ];

  const commandItems = [
    ['Vehicle', 'Fuel Level', 'Check fuel level', 1],
    ['Vehicle', 'Oil Level', 'Check engine oil', 2],
    ['Vehicle', 'Warning Lights', 'Test emergency lights and siren', 3],
    ['Communications', 'Portable Radios', 'Check all portable radios and batteries', 4],
    ['Communications', 'Mobile Radio', 'Test mobile radio', 5],
    ['Communications', 'Laptop/Tablet', 'Check MDT/laptop charge and operation', 6],
    ['Equipment', 'Command Vest', 'Inspect command vest', 7],
    ['Equipment', 'Pre-Plans', 'Verify pre-plans are current', 8],
    ['Medical', 'First Aid Kit', 'Inspect first aid supplies', 9],
    ['Exterior', 'Tires', 'Check tire condition', 10],
    ['Exterior', 'Lights', 'Test all exterior lights', 11],
  ];

  const itemSets: Record<string, typeof engineItems> = {
    'Engine': engineItems,
    'Ladder': ladderItems,
    'Rescue': rescueItems,
    'Tanker': tankerItems,
    'Command': commandItems,
  };

  for (const app of apparatus) {
    const result = insertApparatus.run(
      app.name, app.type, app.unit, app.year, app.make, app.model, 'active'
    );
    const apparatusId = result.lastInsertRowid;
    const items = itemSets[app.type] || engineItems;
    for (const [category, name, description, sortOrder] of items) {
      insertItem.run(apparatusId, category, name, description, sortOrder);
    }
  }
}
