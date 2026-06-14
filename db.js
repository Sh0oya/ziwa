'use strict';
// db.js — initialisation SQLite (better-sqlite3) + requêtes typées.
// Base locale unique dans data/tracker.db. Aucune dépendance réseau.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'tracker.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // robuste aux coupures de courant du Pi
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,            -- YYYY-MM-DD (heure locale)
  type            TEXT NOT NULL,            -- 'morning' | 'snack' | 'evening'
  fed_at          INTEGER,                  -- timestamp ms
  fed_packets     REAL,                     -- 1.0 .. 2.0 (snack: 0.25 .. 1)
  shot_at         INTEGER,                  -- timestamp ms (null pour snack)
  shot_dose       REAL,                     -- UI réellement injectées
  shot_dose_choice TEXT,                    -- 'minus' | 'target' | 'plus'
  notes           TEXT,
  UNIQUE(date, type)
);
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at  INTEGER NOT NULL,            -- timestamp ms
  type         TEXT NOT NULL,               -- 'hypo' | 'hyper' | 'other'
  symptoms     TEXT,                        -- JSON array stringifié
  severity     TEXT,                        -- 'mild' | 'moderate' | 'severe'
  glucose_mgdl REAL,                        -- glycémie mesurée (mg/dL), optionnelle
  ai_analysis  TEXT,                        -- JSON de la réponse IA
  notes        TEXT
);
CREATE TABLE IF NOT EXISTS dose_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  changed_at  INTEGER NOT NULL,
  moment      TEXT NOT NULL,                -- 'morning' | 'evening'
  old_dose    REAL,
  new_dose    REAL,
  reason      TEXT                          -- 'manual' | 'ai_suggested' | 'vet_advice'
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_events_time   ON events(occurred_at);
`);

// ── Migrations légères (ajout de colonnes sur bases existantes) ──────────
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}
ensureColumn('events', 'glucose_mgdl', 'REAL');   // glycémie mesurée au glucomètre (mg/dL)

// ── Réglages par défaut (initialisés au premier lancement) ──────────────
const DEFAULT_SETTINGS = {
  cat_name: 'Ziwa',
  cat_weight_kg: 4.5,
  morning_time: '08:00',
  snack_time: '13:00',
  evening_time: '20:00',
  window_tolerance_h: 2,
  morning_dose_target: 2,
  evening_dose_target: 2,
  dose_unit: 'UI',
  insulin_type: 'Lantus',
  food_brand: 'Caats — saumon',
  food_kcal_per_100g: 90,
  food_protein_pct: 10.5,
  food_fat_pct: 5,
  food_carbs_pct: 1.5,
  food_humidity_pct: 80,
  food_packet_weight_g: 85,
  snack_enabled: true,
};

function coerce(key, raw) {
  const def = DEFAULT_SETTINGS[key];
  if (typeof def === 'number') { const n = parseFloat(raw); return Number.isFinite(n) ? n : def; }
  if (typeof def === 'boolean') return raw === 'true' || raw === '1' || raw === true;
  return raw;
}
function serialize(v) { return typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v); }

const _getAllSettings = db.prepare('SELECT key, value FROM settings');
const _upsertSetting  = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');

(function ensureDefaults() {
  const have = new Set(_getAllSettings.all().map(r => r.key));
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!have.has(k)) _upsertSetting.run(k, serialize(v));
  });
  tx();
})();

function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of _getAllSettings.all()) out[r.key] = coerce(r.key, r.value);
  return out;
}
function setSettings(patch) {
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null) continue;
      _upsertSetting.run(k, serialize(v));
    }
  });
  tx();
  return getSettings();
}

// ── Sessions ────────────────────────────────────────────────────────────
const SESSION_COLS = ['fed_at', 'fed_packets', 'shot_at', 'shot_dose', 'shot_dose_choice', 'notes'];
const _sessByDate = db.prepare('SELECT * FROM sessions WHERE date=? ORDER BY type');
const _sessRange  = db.prepare('SELECT * FROM sessions WHERE date>=? ORDER BY date DESC, type');
const _sessGet    = db.prepare('SELECT * FROM sessions WHERE date=? AND type=?');
const _lastShot   = db.prepare('SELECT * FROM sessions WHERE shot_at IS NOT NULL ORDER BY shot_at DESC LIMIT 1');

function getSessionsByDate(date) { return _sessByDate.all(date); }
function getSessionsSince(dateStr) { return _sessRange.all(dateStr); }
function getSession(date, type) { return _sessGet.get(date, type); }
function lastShot() { return _lastShot.get() || null; }

function upsertSession(date, type, patch) {
  const existing = _sessGet.get(date, type);
  const cols = SESSION_COLS.filter(c => Object.prototype.hasOwnProperty.call(patch, c));
  if (!existing) {
    const fields = ['date', 'type', ...cols];
    const placeholders = fields.map(() => '?').join(',');
    db.prepare(`INSERT INTO sessions (${fields.join(',')}) VALUES (${placeholders})`)
      .run(date, type, ...cols.map(c => patch[c]));
  } else if (cols.length) {
    const set = cols.map(c => `${c}=?`).join(',');
    db.prepare(`UPDATE sessions SET ${set} WHERE date=? AND type=?`)
      .run(...cols.map(c => patch[c]), date, type);
  }
  return _sessGet.get(date, type);
}

// ── Événements ──────────────────────────────────────────────────────────
const _createEvent = db.prepare('INSERT INTO events (occurred_at,type,symptoms,severity,glucose_mgdl,notes) VALUES (?,?,?,?,?,?)');
const _getEvent    = db.prepare('SELECT * FROM events WHERE id=?');
const _eventsRange = db.prepare('SELECT * FROM events WHERE occurred_at>=? ORDER BY occurred_at DESC');
const _setAnalysis = db.prepare('UPDATE events SET ai_analysis=? WHERE id=?');

function getEvent(id) { return _getEvent.get(id); }
function createEvent({ occurred_at, type, symptoms, severity, glucose_mgdl, notes }) {
  const g = (glucose_mgdl === '' || glucose_mgdl == null || !Number.isFinite(Number(glucose_mgdl))) ? null : Number(glucose_mgdl);
  const info = _createEvent.run(occurred_at, type, JSON.stringify(symptoms || []), severity || null, g, notes || null);
  return getEvent(info.lastInsertRowid);
}
function getEventsSince(ts) { return _eventsRange.all(ts); }
function setEventAnalysis(id, json) { _setAnalysis.run(typeof json === 'string' ? json : JSON.stringify(json), id); }

// ── Historique des doses ────────────────────────────────────────────────
const _addDose   = db.prepare('INSERT INTO dose_history (changed_at,moment,old_dose,new_dose,reason) VALUES (?,?,?,?,?)');
const _doseRange = db.prepare('SELECT * FROM dose_history WHERE changed_at>=? ORDER BY changed_at DESC');

function addDoseHistory({ changed_at, moment, old_dose, new_dose, reason }) {
  _addDose.run(changed_at, moment, old_dose, new_dose, reason);
}
function getDoseHistorySince(ts) { return _doseRange.all(ts); }

module.exports = {
  db, DEFAULT_SETTINGS,
  getSettings, setSettings,
  getSessionsByDate, getSessionsSince, getSession, upsertSession, lastShot,
  createEvent, getEvent, getEventsSince, setEventAnalysis,
  addDoseHistory, getDoseHistorySince,
};
