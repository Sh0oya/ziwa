'use strict';
// server.js — backend Express : sert le frontend (public/) et l'API JSON.
// Aucune authentification (kiosque domestique sur réseau local).

require('dotenv').config();
const path = require('path');
const express = require('express');
const db = require('./db');
const ai = require('./ai');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ── helpers date (heure locale du Pi) ───────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function dateNDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); }
function resolveDate(v) { return (!v || v === 'today') ? localDate() : v; }
function safeParse(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

// ── Settings ────────────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => res.json(db.getSettings()));

app.post('/api/settings', (req, res) => {
  const patch = req.body || {};
  const clean = {};
  for (const k of Object.keys(db.DEFAULT_SETTINGS)) if (k in patch) clean[k] = patch[k];
  res.json(db.setSettings(clean));
});

// ── Sessions ────────────────────────────────────────────────────────────
// GET /api/sessions?date=today        → sessions du jour
// GET /api/sessions?days=30           → historique
app.get('/api/sessions', (req, res) => {
  if (req.query.date) return res.json(db.getSessionsByDate(resolveDate(req.query.date)));
  const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 365);
  res.json(db.getSessionsSince(dateNDaysAgo(days)));
});

// GET /api/state → tout ce dont la vue principale a besoin en un appel
app.get('/api/state', (_req, res) => {
  const today = localDate();
  res.json({
    now: Date.now(),
    today,
    settings: db.getSettings(),
    today_sessions: db.getSessionsByDate(today),
    last_shot: db.lastShot(),
  });
});

// POST /api/sessions  { date?, type, patch:{...} } → upsert d'une action
app.post('/api/sessions', (req, res) => {
  const { date, type, patch } = req.body || {};
  if (!['morning', 'snack', 'evening'].includes(type)) return res.status(400).json({ error: 'type invalide' });
  const allowed = ['fed_at', 'fed_packets', 'shot_at', 'shot_dose', 'shot_dose_choice', 'notes'];
  const clean = {};
  for (const k of allowed) if (patch && k in patch) clean[k] = patch[k];
  res.json(db.upsertSession(resolveDate(date), type, clean));
});

// ── Événements ──────────────────────────────────────────────────────────
app.post('/api/events', (req, res) => {
  const { occurred_at, type, symptoms, severity, glucose_mgdl, notes } = req.body || {};
  if (!['hypo', 'hyper', 'other'].includes(type)) return res.status(400).json({ error: 'type invalide' });
  res.json(db.createEvent({ occurred_at: occurred_at || Date.now(), type, symptoms, severity, glucose_mgdl, notes }));
});

app.get('/api/events', (req, res) => {
  const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 365);
  res.json(db.getEventsSince(Date.now() - days * 86400000));
});

// ── Analyse IA ──────────────────────────────────────────────────────────
// POST /api/analyze { event_id } → appelle Claude, stocke et renvoie le JSON.
app.post('/api/analyze', async (req, res) => {
  const ev = db.getEvent((req.body || {}).event_id);
  if (!ev) return res.status(404).json({ error: 'événement introuvable' });
  try {
    const sinceTs = Date.now() - 30 * 86400000;
    const result = await ai.analyzeEvent({
      event: { ...ev, symptoms: safeParse(ev.symptoms, []) },
      settings: db.getSettings(),
      sessions: db.getSessionsSince(dateNDaysAgo(30)),
      doseHistory: db.getDoseHistorySince(sinceTs),
      previousEvents: db.getEventsSince(sinceTs).filter(e => e.id !== ev.id),
    });
    db.setEventAnalysis(ev.id, result);
    res.json(result);
  } catch (err) {
    console.error('[analyze]', err.code || '', err.message);
    res.status(503).json({ error: 'Analyse IA indisponible', code: err.code || 'ai_error' });
  }
});

// ── Application d'un changement de dose (manuel ou suggéré par l'IA) ──────
app.post('/api/dose-change', (req, res) => {
  const { moment, new_dose, reason = 'manual' } = req.body || {};
  if (!['morning', 'evening'].includes(moment)) return res.status(400).json({ error: 'moment invalide' });
  const dose = Number(new_dose);
  if (!Number.isFinite(dose)) return res.status(400).json({ error: 'dose invalide' });
  const key = moment === 'morning' ? 'morning_dose_target' : 'evening_dose_target';
  const old_dose = db.getSettings()[key];
  db.setSettings({ [key]: dose });
  db.addDoseHistory({ changed_at: Date.now(), moment, old_dose, new_dose: dose, reason });
  res.json({ ok: true, moment, old_dose, new_dose: dose, settings: db.getSettings() });
});

// ── Export CSV (90 jours par défaut) — séparateur ; + BOM pour Excel FR ──
// Inclut sessions (repas/piqûres) ET événements glycémiques (type, glycémie mg/dL,
// sévérité, symptômes) rattachés à leur jour, pour un suivi exploitable par le véto.
app.get('/api/export.csv', (req, res) => {
  const days = Math.min(parseInt(req.query.days || '90', 10) || 90, 365);
  const sinceDate = dateNDaysAgo(days);
  const rows = db.getSessionsSince(sinceDate);
  const events = db.getEventsSince(Date.now() - days * 86400000);
  const unit = db.getSettings().dose_unit || 'UI';
  const sep = ';';
  const fmtTime = ts => { if (!ts) return ''; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fr = n => (n === null || n === undefined || n === '') ? '' : String(n).replace('.', ',');
  const label = t => ({ morning: 'Matin', snack: 'Snack', evening: 'Soir' }[t] || t);
  const evLabel = t => ({ hypo: 'Hypoglycémie', hyper: 'Hyperglycémie', other: 'Autre' }[t] || t);
  const sevLabel = s => ({ mild: 'Léger', moderate: 'Modéré', severe: 'Sévère' }[s] || s || '');
  const esc = s => `"${String(s == null ? '' : s).replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;

  // Événements indexés par jour (heure locale), pour rattacher au jour de session.
  const evByDate = {};
  for (const e of events) {
    const d = localDate(new Date(e.occurred_at));
    (evByDate[d] = evByDate[d] || []).push(e);
  }

  const header = ['Date', 'Session', 'Heure repas', 'Paquets', 'Heure piqûre',
    `Dose (${unit})`, 'Choix dose', 'Événement', 'Glycémie (mg/dL)', 'Sévérité', 'Symptômes', 'Notes'];
  const lines = [header.join(sep)];

  // Lignes de sessions (une par session). On accroche le 1er événement du jour à la 1re ligne.
  const seenEventDay = {};
  for (const r of rows) {
    const dayEvents = evByDate[r.date] || [];
    let ev = '', gly = '', sev = '', sympt = '', evNotes = '';
    if (dayEvents.length && !seenEventDay[r.date]) {
      seenEventDay[r.date] = true;
      const e = dayEvents[0];
      ev = evLabel(e.type); gly = fr(e.glucose_mgdl); sev = sevLabel(e.severity);
      sympt = (safeParse(e.symptoms, []) || []).join(', '); evNotes = e.notes || '';
    }
    lines.push([r.date, label(r.type), fmtTime(r.fed_at), fr(r.fed_packets),
      fmtTime(r.shot_at), fr(r.shot_dose), r.shot_dose_choice || '',
      ev, gly, sev, esc(sympt), esc([r.notes, evNotes].filter(Boolean).join(' · '))].join(sep));
  }

  // Événements de jours SANS aucune session (sinon ils seraient perdus).
  for (const [date, list] of Object.entries(evByDate)) {
    if (seenEventDay[date] || date < sinceDate) continue;
    for (const e of list) {
      lines.push([date, 'Événement', '', '', fmtTime(e.occurred_at), '', '',
        evLabel(e.type), fr(e.glucose_mgdl), sevLabel(e.severity),
        esc((safeParse(e.symptoms, []) || []).join(', ')), esc(e.notes)].join(sep));
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ziwa-suivi-${localDate()}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

// Port : argument CLI explicite prioritaire (ex. `node server.js 3010`), sinon PORT, sinon 3000.
const PORT = process.argv[2] || process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ziwa — suivi diabète félin · http://localhost:${PORT}`));
