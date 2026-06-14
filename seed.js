'use strict';
// seed.js — données de démonstration : réglages par défaut + ~24 jours de
// sessions, quelques événements et un changement de dose.
//   node seed.js            → ajoute les données si absentes (idempotent)
//   node seed.js --reset    → vide sessions/events/dose_history puis re-seed
require('dotenv').config();
const db = require('./db');

const reset = process.argv.includes('--reset');
const pad = n => String(n).padStart(2, '0');
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function at(daysAgo, hh, mm) { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0); return d.getTime(); }
function dstr(daysAgo) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return localDate(d); }

if (reset) {
  db.db.exec('DELETE FROM sessions; DELETE FROM events; DELETE FROM dose_history;');
  console.log('· tables vidées (sessions, events, dose_history)');
}

const S = db.getSettings();
const md = S.morning_dose_target, ed = S.evening_dose_target;

// ── ~24 jours d'historique (du plus ancien à hier) ──────────────────────
const DAYS = 24;
let created = 0;
for (let i = DAYS; i >= 1; i--) {
  const date = dstr(i);
  const mPk = 1 + (i % 3) * 0.25;            // 1 .. 1,5 paquet
  const ePk = 1.25 + ((i + 1) % 3) * 0.25;   // 1,25 .. 1,75
  const mMin = 3 + (i % 4) * 3;              // 8h03 .. 8h12
  const eMin = 4 + (i % 5);                  // 20h04 .. 20h08
  db.upsertSession(date, 'morning', { fed_at: at(i, 8, mMin), fed_packets: mPk, shot_at: at(i, 8, mMin + 12), shot_dose: md, shot_dose_choice: 'target' });
  if (i % 2 === 0) db.upsertSession(date, 'snack', { fed_at: at(i, 13, 8), fed_packets: 0.5 });
  db.upsertSession(date, 'evening', { fed_at: at(i, 20, eMin), fed_packets: ePk, shot_at: at(i, 20, eMin + 16), shot_dose: ed, shot_dose_choice: 'target' });
  created++;
}

// ── Aujourd'hui : nourrie le matin, pas encore piquée → vue « À PIQUER » ─
db.upsertSession(dstr(0), 'morning', { fed_at: at(0, 8, 5), fed_packets: 1.5 });

// ── Événements + changement de dose (seulement si vide ou --reset) ──────
if (reset || db.getEventsSince(0).length === 0) {
  db.createEvent({ occurred_at: at(2, 10, 40), type: 'hypo', severity: 'mild', symptoms: ['faiblesse'], glucose_mgdl: 54, notes: 'Un peu mollassonne avant le repas du matin' });
  db.createEvent({ occurred_at: at(7, 10, 55), type: 'hypo', severity: 'mild', symptoms: ['faiblesse', 'tremblements'], glucose_mgdl: 48, notes: 'Tremblements légers, a mangé du miel' });
  db.createEvent({ occurred_at: at(12, 21, 30), type: 'hyper', severity: 'mild', symptoms: ['soif', 'urines'], glucose_mgdl: 340, notes: 'A beaucoup bu dans la soirée' });
}
if (reset || db.getDoseHistorySince(0).length === 0) {
  db.addDoseHistory({ changed_at: at(15, 9, 0), moment: 'morning', old_dose: md + 0.5, new_dose: md, reason: 'vet_advice' });
}

console.log(`✓ Seed terminé : ${created} jours de sessions, événements + 1 changement de dose.`);
console.log(`  Lancez « npm start » puis ouvrez http://localhost:${process.env.PORT || 3000}`);
