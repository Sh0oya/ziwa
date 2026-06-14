'use strict';
/* ============================================================================
   Ziwa — logique frontend (JS vanilla, sans framework, sans build step).
   Reproduit exactement le design « Direction B ». Branché au backend Express.
   Vues: main / settings / history · couches: modal / moment / toast / saver.
   ========================================================================== */
(function () {

  // ---------- petits helpers DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function appendHTML(parent, html) { const t = document.createElement('template'); t.innerHTML = html; parent.appendChild(t.content); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- format ----------
  const pad = n => String(n).padStart(2, '0');
  function nf(n) { return (Math.round(Number(n) * 100) / 100).toString().replace('.', ','); } // 1.5 -> "1,5"
  function U() { return (state.settings && state.settings.dose_unit) || 'UI'; }                // unité de dose réglable
  function doseStr(n, sp) { return nf(n) + (sp === false ? '' : ' ') + U(); }                  // "2 UI" (ou "2UI" si sp=false)
  const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function frDate(d) { return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`; }
  function clockStr(d) { return pad(d.getHours()) + 'h' + pad(d.getMinutes()); }
  function hm(ts) { const d = new Date(ts); return pad(d.getHours()) + 'h' + pad(d.getMinutes()); }
  function durStr(ms) { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60), mm = m % 60; return h > 0 ? `${h}h ${pad(mm)}` : `${mm} min`; }
  function labelTime(hhmm) { const [h, m] = String(hhmm).split(':'); return m === '00' ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`; }
  function localDateNow() { const d = new Date(state.now || Date.now()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function localDateFromTs(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function frShort(dateStr) { const p = String(dateStr).split('-'); return `${parseInt(p[2], 10)} ${MONTHS_FR[parseInt(p[1], 10) - 1].slice(0, 4).replace('é', 'é')}`; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------- API ----------
  const API = {
    async get(p) { const r = await fetch(p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); },
    async post(p, b) {
      const r = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.code = j.code; e.status = r.status; throw e; }
      return j;
    },
  };

  // ---------- listes de symptômes ----------
  const HYPO_SYMPTOMS = [
    { id: 'faiblesse', label: 'Faiblesse / tituber' },
    { id: 'tremblements', label: 'Tremblements' },
    { id: 'pupilles', label: 'Pupilles dilatées' },
    { id: 'bave', label: 'Bave / hypersalivation' },
    { id: 'convulsions', label: 'Convulsions', danger: true },
    { id: 'coma', label: 'Coma / inconscience', danger: true },
  ];
  const HYPER_SYMPTOMS = [
    { id: 'soif', label: 'Soif excessive' },
    { id: 'urines', label: 'Urines fréquentes' },
    { id: 'lethargie', label: 'Léthargie inhabituelle' },
    { id: 'appetit', label: 'Perte d’appétit' },
    { id: 'vomiss', label: 'Vomissements' },
    { id: 'haleine', label: 'Haleine fruitée', danger: true },
  ];

  // ---------- chat Ziwa (SVG, port vanilla) ----------
  function ziwaCat(o) {
    o = o || {};
    const mood = o.mood || 'calm', size = o.size || 130, ink = o.ink || '#2A2420', bg = o.bg || '#FBF6EC', bandana = o.bandana || '#E07E6B', note = !!o.note;
    const sw = 3.4;
    const C = `fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
    const F = `fill="${bg}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"`;
    const B = `fill="none" stroke="${bandana}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
    let eyes;
    if (mood === 'happy') eyes = `<path d="M52 47 q6 -7 12 0" ${C}/><path d="M76 47 q6 -7 12 0" ${C}/>`;
    else if (mood === 'sleep') eyes = `<path d="M52 49 q6 6 12 0" ${C}/><path d="M76 49 q6 6 12 0" ${C}/>`;
    else if (mood === 'alert') eyes = `<circle cx="58" cy="47" r="4.4" fill="${ink}"/><circle cx="82" cy="47" r="4.4" fill="${ink}"/>`;
    else eyes = `<circle cx="58" cy="48" r="3.6" fill="${ink}"/><circle cx="82" cy="48" r="3.6" fill="${ink}"/>`;
    const noteSvg = note ? `<g stroke="${bandana}" fill="${bandana}"><path d="M118 30 L 118 8 L 130 5 L 130 24" fill="none" stroke-width="3" stroke-linecap="round"/><circle cx="114" cy="31" r="4.5"/><circle cx="126" cy="25" r="4.5"/></g>` : '';
    return `<svg viewBox="0 0 140 162" width="${size}" height="${size * 162 / 140}" aria-hidden="true">
      <path d="M104 128 C 134 126, 136 86, 110 84" ${C}/>
      <path d="M70 64 C 38 64, 30 104, 35 132 C 37 146, 52 150, 70 150 C 88 150, 103 146, 105 132 C 110 104, 102 64, 70 64 Z" ${F}/>
      <path d="M56 150 q6 -10 12 0" ${C}/><path d="M72 150 q6 -10 12 0" ${C}/>
      <path d="M44 30 L 38 6 L 60 22 Z" ${F}/><path d="M96 30 L 102 6 L 80 22 Z" ${F}/>
      <path d="M45 24 L 43 13 L 53 21" ${B}/><path d="M95 24 L 97 13 L 87 21" ${B}/>
      <circle cx="70" cy="46" r="31" ${F}/>
      ${eyes}
      <path d="M65 55 L 75 55 L 70 61 Z" fill="${bandana}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M70 61 q -6 8 -13 5 M70 61 q 6 8 13 5" ${C}/>
      <g fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
        <path d="M44 52 L 18 47"/><path d="M44 58 L 19 60"/><path d="M96 52 L 122 47"/><path d="M96 58 L 121 60"/>
      </g>
      <path d="M52 70 Q 70 80 88 70 L 80 92 Q 70 97 60 92 Z" fill="${bandana}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M66 73 q4 3 8 0" fill="none" stroke="${bg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ${noteSvg}
    </svg>`;
  }

  // ---------- état global ----------
  const state = {
    settings: null, today: null,
    sessions: { morning: null, snack: null, evening: null },
    lastShot: null, now: Date.now(), nowOffset: 0,
    view: 'main', modal: null, moment: null, toast: null, saver: false,
    preview: null, histRange: 30, historyRows: [], settingsDraft: {},
  };
  // horloge (avec décalage QA optionnel ?now=HH:MM)
  function nowTs() { return Date.now() + (state.nowOffset || 0); }

  // ---------- chargement des données ----------
  function indexSessions(rows) { const o = { morning: null, snack: null, evening: null }; for (const r of (rows || [])) o[r.type] = r; return o; }
  async function loadState() {
    const s = await API.get('/api/state');
    state.settings = s.settings; state.today = s.today; state.lastShot = s.last_shot;
    state.sessions = indexSessions(s.today_sessions); state.now = nowTs();
  }

  // ---------- logique sessions / fenêtres ----------
  function timeToTodayTs(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); const d = new Date(state.now); d.setHours(h, m, 0, 0); return d.getTime(); }
  function sessFed(t) { const r = state.sessions[t]; return !!(r && r.fed_at != null); }
  function sessShot(t) { const r = state.sessions[t]; return !!(r && r.shot_at != null); }
  function sessDone(t) { const r = state.sessions[t]; if (!r) return false; return t === 'snack' ? r.fed_at != null : (r.fed_at != null && r.shot_at != null); }
  function snackPassed() { return state.now > piqueWindow('snack').end; }

  // Fenêtre d'action = heure cible configurée ± tolérance (ex. 20h → 18h–22h).
  // On ancre sur l'heure RÉGLÉE (et non sur « dernière piqûre + 12h ») pour que
  // l'on puisse toujours agir dès H-2 : à 18h pour une cible de 20h.
  function sessionTargetTime(type) { return type === 'morning' ? state.settings.morning_time : type === 'evening' ? state.settings.evening_time : state.settings.snack_time; }
  // Tolérance de fenêtre : piqûres = window_tolerance_h (déf. 2h) ; snack = 1h (cf. CDC §2),
  // mais SYMÉTRIQUE (± tol) pour autoriser le « en avance » comme matin/soir.
  function windowTol(type) { return (type === 'snack' ? 1 : state.settings.window_tolerance_h) * 3600000; }
  function piqueWindow(type) {
    const target = timeToTodayTs(sessionTargetTime(type));
    const tol = windowTol(type);
    return { target, start: target - tol, end: target + tol };
  }
  function inWindow(type) { const w = piqueWindow(type); return state.now >= w.start && state.now <= w.end; }

  // Session active : on suit les fenêtres réglées (et non des tranches fixes), pour
  // que la bonne session passe au premier plan partout dans son créneau H-2/H+2.
  // Priorité : une session ouverte non terminée > la prochaine à venir.
  function activeType() {
    const snackOn = state.settings.snack_enabled;
    const order = snackOn ? ['morning', 'snack', 'evening'] : ['morning', 'evening'];
    // 1) une fenêtre ouverte avec une action encore à faire ?
    for (const t of order) if (inWindow(t) && !sessDone(t)) return t;
    // 2) sinon la prochaine session dont la fenêtre n'est pas encore passée
    for (const t of order) if (state.now < piqueWindow(t).end && !sessDone(t)) return t;
    // 3) toutes faites/passées → on s'aligne sur la tranche horaire courante
    const h = new Date(state.now).getHours() + new Date(state.now).getMinutes() / 60;
    if (h < 11) return 'morning';
    if (h < 16 && snackOn) return 'snack';
    return 'evening';
  }

  // modèle de vue de la zone principale (statut, couleur, décompte, humeur…)
  function computeVM() {
    if (state.preview) return previewVM(state.preview);
    const now = state.now, type = activeType();

    if (type === 'snack') {
      const sessLbl = 'SNACK · CIBLE ' + labelTime(state.settings.snack_time);
      if (sessDone('snack')) return { type: 'snack', phase: 'done', snack: true, sess: sessLbl, status: 'FAIT', color: 'green', sub: 'À tout à l’heure pour le soir', count: 'Prochaine étape : soir, ' + labelTime(state.settings.evening_time), mood: 'happy', bar: 100 };
      const w = piqueWindow('snack');
      let count;
      if (now < w.start) count = 'Snack vers ' + labelTime(state.settings.snack_time) + ' (dans ' + durStr(w.target - now) + ')';
      else if (now < w.target) count = 'En avance · cible ' + labelTime(state.settings.snack_time) + ' (encore ' + durStr(w.target - now) + ')';
      else if (now <= w.end) count = 'Fenêtre encore ' + durStr(w.end - now);
      else count = 'Snack en retard';
      return { type: 'snack', phase: 'snack', snack: true, sess: sessLbl, status: 'SNACK', color: 'neutral', sub: 'Petit repas — pas de piqûre', count, mood: 'calm', bar: 55 };
    }

    const target = state.settings[type === 'morning' ? 'morning_dose_target' : 'evening_dose_target'];
    const win = piqueWindow(type);
    const fed = sessFed(type), shot = sessShot(type);
    const sess = (type === 'morning' ? 'MATIN' : 'SOIR') + ' · CIBLE ' + labelTime(type === 'morning' ? state.settings.morning_time : state.settings.evening_time);
    const dose = doseStr(target);

    if (fed && shot) {
      const r = state.sessions[type]; const next = r.shot_at + 12 * 3600000;
      return { type, phase: 'done', sess, status: 'FAIT', color: 'green', dose: doseStr(r.shot_dose), doseTag: 'injectées', count: 'Prochaine piqûre dans ' + durStr(next - now), mood: 'happy', bar: 100 };
    }
    if (now < win.start)
      return { type, phase: 'early', sess, status: 'Prochaine piqûre', statusSmall: true, color: 'neutral', dose, doseTag: 'dose prévue', count: 'dans ' + durStr(win.target - now), mood: 'calm', bar: 14 };
    if (now <= win.end) {
      // Dans la fenêtre H-2/H+2 : actions possibles. Avant l'heure cible on affiche
      // « en avance », après on décompte la fin de fenêtre.
      const ahead = now < win.target;
      const count = ahead ? 'En avance · cible ' + labelTime(sessionTargetTime(type)) + ' (encore ' + durStr(win.target - now) + ')'
                          : 'Fenêtre encore ' + durStr(win.end - now);
      const frac = clamp((now - win.start) / (win.end - win.start), 0, 1);
      if (!fed) return { type, phase: 'toFeed', sess, status: 'À NOURRIR', color: 'orange', dose, doseTag: 'dose prévue', count, mood: 'calm', bar: Math.round(14 + frac * 44) };
      return { type, phase: 'toShot', sess, status: 'À PIQUER', color: 'orange', dose, doseTag: 'à injecter', count, mood: 'calm', bar: Math.round(50 + frac * 45) };
    }
    const lateBy = 'Retard de ' + durStr(now - win.end);
    if (!fed) return { type, phase: 'late', sess, status: 'À NOURRIR', color: 'red', dose, doseTag: 'dose prévue', count: lateBy, mood: 'alert', bar: 100 };
    return { type, phase: 'late', sess, status: 'À PIQUER', color: 'red', dose, doseTag: 'à injecter', count: lateBy, mood: 'alert', bar: 100 };
  }

  function dayView() {
    if (state.preview) return previewDay(state.preview);
    const t = activeType(); const r = state.sessions[t] || {}; const s = state.sessions.snack;
    return {
      activeType: t,
      fed: r.fed_at != null, fedTime: r.fed_at != null ? hm(r.fed_at) : null, fedPackets: r.fed_packets,
      shot: r.shot_at != null, shotTime: r.shot_at != null ? hm(r.shot_at) : null, shotDose: r.shot_dose,
      target: state.settings[t === 'morning' ? 'morning_dose_target' : 'evening_dose_target'],
      snackDone: !!(s && s.fed_at != null), snackTime: s && s.fed_at != null ? hm(s.fed_at) : null, snackPackets: s && s.fed_packets,
    };
  }

  // aperçu QA (?preview=tofeed|toshot|late|done|snack) — n'écrit jamais en base
  function previewVM(p) {
    const T = (state.settings && state.settings.morning_dose_target) || 2; const base = { type: 'morning', sess: 'MATIN · CIBLE 8H' };
    if (p === 'tofeed') return { ...base, phase: 'toFeed', status: 'À NOURRIR', color: 'orange', dose: doseStr(T), doseTag: 'dose prévue', count: 'Fenêtre encore 1h 47', mood: 'calm', bar: 32 };
    if (p === 'toshot') return { ...base, phase: 'toShot', status: 'À PIQUER', color: 'orange', dose: doseStr(T), doseTag: 'à injecter', count: 'Fenêtre encore 1h 12', mood: 'calm', bar: 58 };
    if (p === 'late') return { ...base, phase: 'late', status: 'À PIQUER', color: 'red', dose: doseStr(T), doseTag: 'à injecter', count: 'Retard de 32 min', mood: 'alert', bar: 100 };
    if (p === 'done') return { ...base, phase: 'done', status: 'FAIT', color: 'green', dose: doseStr(T), doseTag: 'injectées', count: 'Prochaine piqûre dans 11h 40', mood: 'happy', bar: 100 };
    if (p === 'snack') return { type: 'snack', phase: 'snack', snack: true, sess: 'SNACK · CIBLE 13H', status: 'SNACK', color: 'neutral', sub: 'Petit repas — pas de piqûre', count: 'Fenêtre encore 47 min', mood: 'calm', bar: 55 };
    return computeVMRealFallback();
  }
  function computeVMRealFallback() { state.preview = null; const vm = computeVM(); state.preview = arguments[0]; return vm; }
  function previewDay(p) {
    const T = (state.settings && state.settings.morning_dose_target) || 2;
    const base = { activeType: 'morning', target: T, fed: false, shot: false, snackDone: false, fedTime: null, shotTime: null };
    if (p === 'toshot' || p === 'late') return { ...base, fed: true, fedTime: '8h05', fedPackets: 1.5 };
    if (p === 'done') return { ...base, fed: true, fedTime: '8h05', fedPackets: 1.5, shot: true, shotTime: '8h20', shotDose: T };
    if (p === 'snack') return { ...base, activeType: 'snack' };
    return base;
  }

  /* ====================== RENDU ====================== */
  function render() {
    const root = $('#device');
    root.innerHTML = state.view === 'settings' ? settingsHTML() : state.view === 'history' ? historyHTML() : mainHTML();
    if (state.modal) appendHTML(root, modalHTML(state.modal));
    if (state.moment) appendHTML(root, momentHTML(state.moment));
    if (state.toast) appendHTML(root, `<div class="toast ${state.toast.tone || ''}">${esc(state.toast.text)}</div>`);
    if (state.saver) appendHTML(root, saverHTML());
    if (state.modal && state.modal.type === 'wheel') initWheels();
  }

  // ---- vue principale ----
  function mainHTML() {
    const vm = computeVM(), day = dayView(), cat = (state.settings.cat_name || 'Ziwa');
    const panel = vm.color;
    const catInk = panel === 'neutral' ? '#2A2420' : '#fff';
    const catBg = panel === 'orange' ? 'var(--orange)' : panel === 'red' ? 'var(--red)' : panel === 'green' ? 'var(--green)' : 'var(--blue)';
    const catBand = panel === 'neutral' ? 'var(--coral)' : '#fff';
    const now = new Date(state.now);
    const center = vm.snack ? `<div class="b-sub">${esc(vm.sub)}</div>` : `<div class="b-dose">${esc(vm.dose)} <small>${esc(vm.doseTag)}</small></div>`;
    const acts = vm.snack ? snackActsHTML(day) : feedShotActsHTML(day);
    return `<div class="b">
      <div class="b-head">
        <span class="wm script">${esc(cat)}</span>
        <div class="r"><span class="d">${esc(frDate(now))}</span><span class="t">${clockStr(now)}</span></div>
      </div>
      <div class="b-body">
        <div class="b-panel ${panel}">
          <div class="b-sess">${esc(vm.sess)}</div>
          <div class="b-status ${vm.statusSmall ? 'sm' : ''}">${esc(vm.status)}</div>
          ${center}
          <div class="b-count">${esc(vm.count)}</div>
          <div class="b-pbar ${panel === 'neutral' ? 'dk' : ''}"><i style="width:${vm.bar}%"></i></div>
          <div class="b-cat">${ziwaCat({ mood: vm.mood, size: 150, ink: catInk, bg: catBg, bandana: catBand, note: vm.mood === 'happy' })}</div>
        </div>
        <div class="b-right">
          ${acts}
          ${logHTML()}
          <div class="b-foot">
            <button class="balarm tap" data-act="alarm" data-arg="hypo"><span>⚠</span>Hypo</button>
            <button class="balarm tap" data-act="alarm" data-arg="hyper"><span>⚠</span>Hyper</button>
            <button class="bgear tap" data-act="settings"><span>⚙</span>Réglages</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function feedShotActsHTML(day) {
    const feedClass = day.fed ? 'done-feed' : 'cta';
    const feedSub = day.fed ? `${day.fedTime} · ${nf(day.fedPackets)} paquet` : '1 à 2 paquets';
    const feedAttr = day.fed ? 'data-act="cancel" data-arg="feed"' : 'data-act="feed"';
    const shotClass = !day.fed ? 'is-disabled' : (day.shot ? 'done-shot' : 'cta');
    const shotSub = day.shot ? `${day.shotTime} · ${doseStr(day.shotDose)}` : (!day.fed ? 'après le repas' : `dose cible ${doseStr(day.target)}`);
    const shotAttr = !day.fed ? '' : (day.shot ? 'data-act="cancel" data-arg="shot"' : 'data-act="shot"');
    return `<div class="b-acts">
      <div class="bact tap ${feedClass}" ${feedAttr}>
        <span class="ic">🥣</span>
        <span class="tx"><span class="k">${day.fed ? 'Nourrie' : 'Nourrir'}</span><span class="h">${esc(feedSub)}</span></span>
        ${day.fed ? '<span class="chk" style="color:var(--coral-deep)">✓</span>' : ''}
      </div>
      <div class="bact tap ${shotClass}" ${shotAttr}>
        <span class="ic">💉</span>
        <span class="tx"><span class="k">${day.shot ? 'Piquée' : 'Piquer'}</span><span class="h">${esc(shotSub)}</span></span>
        ${day.shot ? '<span class="chk" style="color:var(--green)">✓</span>' : ''}
      </div>
    </div>`;
  }

  function snackActsHTML(day) {
    const done = day.snackDone;
    const sub = done ? `${day.snackTime} · ${nf(day.snackPackets)} paquet` : `≈ ${Math.round(0.5 * state.settings.food_packet_weight_g)} g · pas de piqûre`;
    return `<div class="b-acts">
      <div class="bact tap ${done ? 'done-feed' : 'cta'}" style="min-height:88px" ${done ? '' : 'data-act="snack"'}>
        <span class="ic">🍽️</span>
        <span class="tx"><span class="k">${done ? 'Snack donné' : 'Donner le snack'}</span><span class="h">${esc(sub)}</span></span>
        ${done ? '<span class="chk" style="color:var(--coral-deep)">✓</span>' : ''}
      </div>
    </div>`;
  }

  function logLine(r, kind) {
    if (kind === 'fed') return r && r.fed_at != null ? `${hm(r.fed_at)} · ${nf(r.fed_packets)}pq` : '— nourrir';
    return r && r.shot_at != null ? `${hm(r.shot_at)} · ${doseStr(r.shot_dose, false)}` : '— piquer';
  }
  function logHTML() {
    const m = state.sessions.morning, s = state.sessions.snack, e = state.sessions.evening;
    const snackDone = !!(s && s.fed_at != null);
    const snackTxt = snackDone ? `${hm(s.fed_at)} ✓` : (snackPassed() ? 'non donné' : 'à ' + labelTime(state.settings.snack_time));
    return `<div class="b-log">
      <div class="chip ${m && m.shot_at != null ? 'ok' : ''}"><span class="nm">Matin</span>
        <span class="v ${m && m.fed_at != null ? '' : 'muted'}">${logLine(m, 'fed')}</span>
        <span class="v ${m && m.shot_at != null ? '' : 'muted'}">${logLine(m, 'shot')}</span></div>
      <div class="chip"><span class="nm">Snack</span><span class="v ${snackDone ? '' : 'muted'}">${esc(snackTxt)}</span></div>
      <div class="chip ${e && e.shot_at != null ? 'ok' : ''}"><span class="nm">Soir</span>
        <span class="v ${e && e.fed_at != null ? '' : 'muted'}">${e && e.fed_at != null ? logLine(e, 'fed') : 'à ' + labelTime(state.settings.evening_time)}</span>
        <span class="v ${e && e.shot_at != null ? '' : 'muted'}">${e && e.fed_at != null ? logLine(e, 'shot') : '— piquer'}</span></div>
    </div>`;
  }

  /* ---- modales ---- */
  function modalHTML(m) {
    const scrim = `<div class="scrim" ${m.type !== 'analysis' ? 'data-act="closeModal"' : ''}></div>`;
    let sheet = '';
    if (m.type === 'feed' || m.type === 'snack') sheet = feedSheet(m);
    else if (m.type === 'shot') sheet = shotSheet(m);
    else if (m.type === 'event') sheet = eventSheet(m);
    else if (m.type === 'analysis') sheet = analysisSheet(m);
    else if (m.type === 'confirm') sheet = confirmSheet(m);
    else if (m.type === 'wheel') sheet = wheelHTML(m);
    else if (m.type === 'kbd') sheet = kbdHTML(m);
    return scrim + sheet;
  }

  function feedSheet(m) {
    const min = m.min, max = m.max, initial = m.initial;
    const title = m.title || 'Combien de paquets donnés ?';
    const ticks = []; for (let v = min; v <= max + 0.001; v += 0.25) ticks.push(Math.round(v * 100) / 100);
    const grams = Math.round(initial * state.settings.food_packet_weight_g);
    const kcal = Math.round(grams / 100 * state.settings.food_kcal_per_100g);
    return `<div class="sheet">
      <div class="sheet-head"><div class="ttl">${esc(title)}</div><button class="x tap" data-act="closeModal">✕</button></div>
      <div class="sheet-body">
        <div class="bignum"><div class="n" id="feedN">${nf(initial)}</div><div class="u" id="feedU">paquet${initial > 1 ? 's' : ''}</div></div>
        <div class="slide-wrap">
          <input class="slide" id="feedSlide" type="range" min="${min}" max="${max}" step="0.25" value="${initial}" data-in="feed">
          <div class="ticks" id="feedTicks">${ticks.map(t => `<span data-t="${t}" class="${t === initial ? 'on' : ''}">${nf(t)}</span>`).join('')}</div>
        </div>
        <div class="calc" id="feedCalc">≈ ${grams} g · ≈ ${kcal} kcal</div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost tap" data-act="closeModal">Annuler</button>
        <button class="btn coral tap" data-act="feedValidate">Valider</button>
      </div>
    </div>`;
  }

  function shotSheet(m) {
    const t = m.target;
    const opts = [{ d: Math.max(0, t - 0.5), l: 'en moins' }, { d: t, l: 'cible', mid: true }, { d: t + 0.5, l: 'en plus' }];
    const choice = ['minus', 'target', 'plus'];
    return `<div class="sheet">
      <div class="sheet-head"><div class="ttl">Quelle dose injectée ?</div><button class="x tap" data-act="closeModal">✕</button></div>
      <div class="sheet-body">
        <div class="dose-target-note">Dose cible : <b>${doseStr(t)}</b></div>
        <div class="doses">
          ${opts.map((o, i) => `<button class="dosebtn tap ${o.mid ? 'target' : ''}" data-act="shotValidate" data-dose="${o.d}" data-choice="${choice[i]}"><span class="dv">${nf(o.d)}</span><span class="dl">${esc(U())} · ${o.l}</span></button>`).join('')}
        </div>
      </div>
      <div class="sheet-foot"><button class="btn ghost tap" data-act="closeModal">Annuler</button></div>
    </div>`;
  }

  function urgBanner(type) {
    return `<div class="urg"><span class="big">🚑</span><span>URGENCE VÉTÉRINAIRE — appelle ton véto maintenant.${type === 'hypo' ? ' En attendant, frotte du miel ou sirop d’érable sur les gencives.' : ''}</span></div>`;
  }
  function eventDanger(m) { return m.sev === 'severe' || m.sel.includes('convulsions') || m.sel.includes('coma') || m.sel.includes('haleine'); }
  // classe une glycémie féline (mg/dL) → libellé + couleur pour le repère visuel
  function glyZone(g) {
    if (g === '' || g == null || !Number.isFinite(Number(g))) return { txt: 'mg/dL', cls: 'dim' };
    const v = Number(g);
    if (v < 60) return { txt: 'hypoglycémie', cls: 'red' };
    if (v <= 130) return { txt: 'normal', cls: 'green' };
    if (v <= 300) return { txt: 'élevée', cls: 'orange' };
    return { txt: 'hyperglycémie', cls: 'red' };
  }
  function eventSheet(m) {
    const list = m.evType === 'hypo' ? HYPO_SYMPTOMS : HYPER_SYMPTOMS;
    const t = new Date(state.now + m.mins * 60000);
    return `<div class="sheet">
      <div class="sheet-head">
        <div class="ttl">${m.evType === 'hypo' ? '⚠ Hypoglycémie signalée' : '⚠ Hyperglycémie signalée'}<small>Coche ce que tu observes chez ${esc(state.settings.cat_name || 'Ziwa')}</small></div>
        <button class="x tap" data-act="closeModal">✕</button>
      </div>
      <div class="ev">
        <div id="urgSlot">${eventDanger(m) ? urgBanner(m.evType) : ''}</div>
        <div class="ev-cols">
          <div class="ev-col">
            <h4>Symptômes observés</h4>
            <div class="symptoms">
              ${list.map(sy => `<div class="sympt tap ${m.sel.includes(sy.id) ? 'on' : ''} ${sy.danger ? 'danger' : ''}" data-act="sympt" data-id="${sy.id}"><span class="box">${m.sel.includes(sy.id) ? '✓' : ''}</span>${esc(sy.label)}</div>`).join('')}
            </div>
          </div>
          <div class="ev-col">
            <h4>Sévérité ressentie</h4>
            <div class="sev">
              ${[['mild', 'Léger'], ['moderate', 'Modéré'], ['severe', 'Sévère']].map(([v, l]) => `<button class="sevbtn tap ${m.sev === v ? 'on' : ''} ${v === 'severe' ? 's3' : ''}" data-act="sev" data-v="${v}">${l}</button>`).join('')}
            </div>
            <div class="field gly-field">
              <label>Glycémie mesurée (si glucomètre)</label>
              <div class="glywrap">
                <input class="glyin" type="number" inputmode="numeric" min="0" max="900" step="1" data-in="glucose" placeholder="—" value="${m.glucose != null ? esc(m.glucose) : ''}">
                <span class="glyunit" id="glyZone"><b class="z-${glyZone(m.glucose).cls}">${glyZone(m.glucose).txt}</b></span>
              </div>
            </div>
            <div class="field">
              <label>Heure de l’événement</label>
              <div class="timepick">
                <button class="stp tap" data-act="evtime" data-d="-5">−</button>
                <span class="tv" id="evTime">${pad(t.getHours())}h${pad(t.getMinutes())}</span>
                <button class="stp tap" data-act="evtime" data-d="5">+</button>
                <span id="evTimeRel" style="font-size:13px;color:var(--dim);margin-left:4px">${m.mins === 0 ? 'maintenant' : 'il y a ' + (-m.mins) + ' min'}</span>
              </div>
            </div>
            <div class="field">
              <label>Notes (optionnel)</label>
              <textarea class="note" data-in="notes" placeholder="Contexte, ce que tu as fait…">${esc(m.notes)}</textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost tap" style="flex:1" data-act="closeModal">Annuler</button>
        <button class="btn red tap" style="flex:1.7;font-size:19px" data-act="eventSubmit">Enregistrer + Analyser IA</button>
      </div>
    </div>`;
  }

  function analysisSheet(m) {
    const gly = m.event && m.event.glucose_mgdl != null ? ` · ${nf(m.event.glucose_mgdl)} mg/dL` : '';
    const head = `<div class="sheet-head"><div class="ttl">Analyse IA${m.phase === 'result' ? `<small>${m.event.type === 'hypo' ? 'Hypoglycémie' : m.event.type === 'hyper' ? 'Hyperglycémie' : 'Événement'} · ${esc(state.settings.cat_name || 'Ziwa')}${gly}</small>` : ''}</div>${m.phase !== 'loading' ? '<button class="x tap" data-act="closeModal">✕</button>' : ''}</div>`;
    if (m.phase === 'loading')
      return `<div class="sheet analysis">${head}<div class="sheet-body"><div class="spin-wrap"><div class="spinner"></div><div class="lab">Analyse en cours…</div><div class="sub">Lecture des 30 derniers jours de suivi</div></div></div></div>`;
    if (m.phase === 'error') {
      const noKey = m.err && m.err.code === 'no_api_key';
      const sub = noKey
        ? 'Clé API Claude absente ou invalide. Renseigne CLAUDE_API_KEY dans le fichier .env du serveur, puis relance l’analyse.'
        : 'Connexion impossible. L’événement est bien enregistré — tu pourras relancer l’analyse plus tard.';
      return `<div class="sheet analysis">${head}<div class="sheet-body"><div class="retry"><div class="ic">📡</div><div class="lab">Analyse IA indisponible</div><div class="sub">${esc(sub)}</div></div></div>
        <div class="sheet-foot"><button class="btn ghost tap" data-act="closeModal">Fermer</button><button class="btn coral tap" data-act="retryAnalysis">Relancer l’analyse</button></div></div>`;
    }
    const r = m.res, reco = r.recommandation_dose || {};
    const niveauLabel = r.niveau_alerte === 'urgent' ? '⚠ Urgent' : r.niveau_alerte === 'attention' ? 'Niveau : Attention' : 'Info';
    const momLabel = reco.moment === 'morning' ? 'Matin' : reco.moment === 'evening' ? 'Soir' : 'Matin & soir';
    const recoHTML = reco.ajuster
      ? `<div class="an-card reco"><h5>Recommandation de dose</h5>
          <div class="change"><span>${momLabel}</span><s>${doseStr(reco.ancien_ui)}</s><span class="arrow">→</span><span>${doseStr(reco.nouveau_ui)}</span></div>
          <p style="font-size:13.5px;color:var(--dim);line-height:1.25">${esc(reco.justification)}</p>
          <div class="reco-acts">
            <button class="apply tap" data-act="applyReco" ${m.applied ? 'disabled' : ''}>${m.applied ? '✓ Appliqué' : 'Appliquer ce changement'}</button>
            <button class="ignore tap" data-act="closeModal">Ignorer</button>
          </div></div>`
      : `<div class="an-card reco"><h5>Recommandation de dose</h5><p>Pas d’ajustement conseillé pour l’instant. ${esc(reco.justification || '')}</p></div>`;
    return `<div class="sheet analysis">${head}
      <div class="an">
        <div><span class="an-badge ${r.niveau_alerte}">${niveauLabel}</span></div>
        <div class="an-card"><h5>Synthèse</h5><p>${esc(r.analyse_synthese)}</p></div>
        <div class="an-row">
          <div class="an-card" style="flex:1"><h5>Hypothèses</h5><ul>${(r.hypotheses || []).map(h => `<li>${esc(h)}</li>`).join('') || '<li>—</li>'}</ul></div>
          <div class="an-card" style="flex:1"><h5>À faire maintenant</h5><ul>${(r.actions_immediates || []).map(a => `<li>${esc(a)}</li>`).join('') || '<li>—</li>'}</ul></div>
        </div>
        ${recoHTML}
        <div class="disclaimer"><span>⚠</span><span>${esc(r.rappel_veto)}</span></div>
      </div>
      <div class="sheet-foot"><button class="btn primary tap" data-act="closeModal">Fermer</button></div>
    </div>`;
  }

  function confirmSheet(m) {
    return `<div class="sheet" style="justify-content:center">
      <div class="sheet-body" style="flex:1;gap:8px">
        <div style="font-size:27px;font-weight:600;text-align:center">${esc(m.text)}</div>
        <div style="font-size:16px;color:var(--dim)">Sécurité contre les appuis accidentels.</div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost tap" data-act="closeModal">Non, garder</button>
        <button class="btn red tap" data-act="confirmYes">Oui, annuler</button>
      </div>
    </div>`;
  }

  function momentHTML(mo) {
    return `<div class="moment ${mo.tone === 'green' ? 'green' : ''}">
      <div class="pop">${ziwaCat({ mood: mo.mood || 'happy', size: 150, ink: '#fff', bg: mo.tone === 'green' ? 'var(--green)' : 'var(--coral)', bandana: '#fff', note: true })}</div>
      <div class="t1 script">${esc(mo.t1)}</div><div class="t2">${esc(mo.t2)}</div>
    </div>`;
  }

  function saverHTML() {
    const now = new Date(state.now);
    return `<div class="saver" data-act="wake">
      ${ziwaCat({ mood: 'sleep', size: 120, ink: '#fff', bg: 'rgba(0,0,0,0)', bandana: '#E07E6B' })}
      <div class="clk">${clockStr(now)}</div>
      <div class="dt">${esc(frDate(now))}</div>
      <div class="nx">${esc(nextShotLabel())}</div>
      <div class="hint">Touche l’écran pour réveiller</div>
    </div>`;
  }
  function nextShotLabel() {
    const ls = state.lastShot;
    if (ls && ls.shot_at) { const n = new Date(ls.shot_at + 12 * 3600000); return 'Prochaine piqûre vers ' + pad(n.getHours()) + 'h' + pad(n.getMinutes()); }
    return 'Prochaine piqûre du soir vers ' + labelTime(state.settings.evening_time);
  }

  /* ---- réglages ---- */
  // Spécif. de chaque champ : 'num' → roue iPhone · 'time' → double roue · 'text' → clavier.
  const SETTING_FIELDS = {
    cat_name: { label: 'Prénom du chat', kind: 'text', wide: true },
    morning_time: { label: 'Cible matin', kind: 'time' },
    evening_time: { label: 'Cible soir', kind: 'time' },
    snack_time: { label: 'Cible snack', kind: 'time' },
    morning_dose_target: { label: 'Dose cible matin', kind: 'num', min: 0, max: 20, step: 0.25, unit: U },
    evening_dose_target: { label: 'Dose cible soir', kind: 'num', min: 0, max: 20, step: 0.25, unit: U },
    window_tolerance_h: { label: 'Tolérance fenêtre', kind: 'num', min: 0, max: 6, step: 0.5, unit: 'h' },
    dose_unit: { label: 'Unité de dose', kind: 'text' },
    insulin_type: { label: 'Type d’insuline', kind: 'text', wide: true },
    cat_weight_kg: { label: 'Poids du chat', kind: 'num', min: 1, max: 15, step: 0.1, unit: 'kg' },
    food_packet_weight_g: { label: 'Poids d’un paquet', kind: 'num', min: 10, max: 200, step: 1, unit: 'g' },
    food_brand: { label: 'Marque aliment', kind: 'text', wide: true },
    food_kcal_per_100g: { label: 'Kcal / 100 g', kind: 'num', min: 0, max: 300, step: 1, unit: 'kcal' },
    food_protein_pct: { label: 'Protéines', kind: 'num', min: 0, max: 100, step: 0.5, unit: '%' },
    food_fat_pct: { label: 'Lipides', kind: 'num', min: 0, max: 100, step: 0.5, unit: '%' },
    food_carbs_pct: { label: 'Glucides', kind: 'num', min: 0, max: 100, step: 0.5, unit: '%' },
    food_humidity_pct: { label: 'Humidité', kind: 'num', min: 0, max: 100, step: 1, unit: '%' },
  };
  function fieldUnit(f) { return typeof f.unit === 'function' ? f.unit() : (f.unit || ''); }
  function setField(key) {
    const f = SETTING_FIELDS[key], v = state.settingsDraft[key];
    const disp = f.kind === 'num' ? nf(v) : v;
    const unit = fieldUnit(f);
    return `<div class="set-f ${f.wide ? 'wide' : ''}"><label>${esc(f.label)}</label>
      <div class="val tap" data-act="setField" data-key="${key}"><span>${esc(disp)}</span>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div></div>`;
  }
  function settingsHTML() {
    const s = state.settingsDraft;
    return `<div class="set">
      <div class="set-head"><button class="bk tap" data-act="back">←</button><div class="ttl">Réglages</div></div>
      <div class="set-cols">
        <div class="set-col">
          <h4>Horaires &amp; doses</h4>
          <div class="set-grid">
            ${setField('cat_name')}
            ${setField('morning_time')}
            ${setField('evening_time')}
            ${setField('snack_time')}
            <div class="set-f"><label>Snack activé</label><div class="val"><span id="snackLbl">${s.snack_enabled ? 'Activé' : 'Désactivé'}</span><span class="toggle tap ${s.snack_enabled ? 'on' : ''}" id="snackToggle" data-act="snackToggle"><i></i></span></div></div>
            ${setField('morning_dose_target')}
            ${setField('evening_dose_target')}
            ${setField('window_tolerance_h')}
            ${setField('dose_unit')}
            ${setField('insulin_type')}
          </div>
        </div>
        <div class="set-col">
          <h4>Nutrition &amp; chat</h4>
          <div class="set-grid">
            ${setField('cat_weight_kg')}
            ${setField('food_packet_weight_g')}
            ${setField('food_brand')}
            ${setField('food_kcal_per_100g')}
            ${setField('food_protein_pct')}
            ${setField('food_fat_pct')}
            ${setField('food_carbs_pct')}
            ${setField('food_humidity_pct')}
            <div class="set-f"><label>Besoin théorique</label><div class="val ro">${Math.round(s.cat_weight_kg * 50)}<span class="unit">kcal/j</span></div></div>
          </div>
        </div>
      </div>
      <div class="set-foot">
        <button class="btn coral tap" style="flex:1.4" data-act="saveSettings">Enregistrer</button>
        <button class="btn tap" data-act="history">Voir l’historique</button>
        <button class="btn ghost tap" data-act="exportCsv">Exporter CSV</button>
      </div>
    </div>`;
  }

  /* ---- roue iPhone (picker) + clavier AZERTY ---- */
  const ROW_H = 54;            // hauteur d'une ligne de roue (px)
  function rangeValues(min, max, step) {
    const out = []; const n = Math.round((max - min) / step);
    for (let i = 0; i <= n; i++) out.push(Math.round((min + i * step) * 100) / 100);
    return out;
  }
  function nearestIdx(values, v) {
    let best = 0, bd = Infinity;
    values.forEach((x, i) => { const d = Math.abs(x - v); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function openPicker(key) {
    const f = SETTING_FIELDS[key], v = state.settingsDraft[key];
    if (f.kind === 'text') { state.modal = { type: 'kbd', key, title: f.label, value: String(v == null ? '' : v), shift: !String(v).length }; render(); return; }
    if (f.kind === 'time') {
      const [hh, mm] = String(v).split(':').map(Number);
      const hours = rangeValues(0, 23, 1), mins = rangeValues(0, 55, 5);
      state.modal = { type: 'wheel', key, title: f.label, kind: 'time',
        columns: [{ values: hours, idx: nearestIdx(hours, hh), pad: true }, { values: mins, idx: nearestIdx(mins, mm), pad: true }] };
      render(); return;
    }
    const values = rangeValues(f.min, f.max, f.step);
    state.modal = { type: 'wheel', key, title: f.label, kind: 'num', unit: fieldUnit(f),
      columns: [{ values, idx: nearestIdx(values, v) }] };
    render();
  }
  function wheelHTML(m) {
    const cols = m.columns.map((c, ci) => {
      const opts = c.values.map((val, i) =>
        `<div class="opt ${i === c.idx ? 'sel' : ''}" data-act="wheelTap" data-col="${ci}" data-i="${i}">${c.pad ? pad(val) : nf(val)}</div>`).join('');
      return `<div class="wheel" data-col="${ci}"><div class="pad"></div>${opts}<div class="pad"></div></div>`;
    }).join(m.kind === 'time' ? '<div class="wheel-sep">:</div>' : '');
    return `<div class="sheet">
      <div class="sheet-head"><div class="ttl">${esc(m.title)}</div><button class="x tap" data-act="closeModal">✕</button></div>
      <div class="sheet-body">
        <div class="picker">
          <div class="pick-band"></div>
          <div class="pick-wheels">${cols}</div>
          ${m.unit ? `<div class="pick-unit">${esc(m.unit)}</div>` : ''}
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost tap" data-act="closeModal">Annuler</button>
        <button class="btn coral tap" data-act="wheelValidate">Valider</button>
      </div>
    </div>`;
  }
  // (ré)attache le défilement natif des roues après chaque render
  function initWheels() {
    const m = state.modal; if (!m || m.type !== 'wheel') return;
    $$('.wheel').forEach(w => {
      const ci = +w.dataset.col, col = m.columns[ci];
      w.scrollTop = col.idx * ROW_H;
      let t = null;
      w.addEventListener('scroll', () => {
        const i = Math.max(0, Math.min(col.values.length - 1, Math.round(w.scrollTop / ROW_H)));
        if (i !== col.idx) {
          col.idx = i;
          w.querySelectorAll('.opt').forEach((o, k) => o.classList.toggle('sel', k === i));
        }
        clearTimeout(t); t = setTimeout(() => { w.scrollTo({ top: col.idx * ROW_H, behavior: 'smooth' }); }, 90);
      }, { passive: true });
    });
  }
  function wheelTap(node) {
    const ci = +node.dataset.col, i = +node.dataset.i;
    const w = $$('.wheel')[ci]; if (w) w.scrollTo({ top: i * ROW_H, behavior: 'smooth' });
  }
  function wheelValidate() {
    const m = state.modal;
    if (m.kind === 'time') {
      const h = m.columns[0].values[m.columns[0].idx], mn = m.columns[1].values[m.columns[1].idx];
      state.settingsDraft[m.key] = pad(h) + ':' + pad(mn);
    } else {
      state.settingsDraft[m.key] = m.columns[0].values[m.columns[0].idx];
    }
    state.modal = null; render();
  }

  // clavier AZERTY tactile (texte) — minuscule/majuscule, accents usuels, chiffres
  const KBD_ROWS = [
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n', 'é', 'è', 'à', '-'],
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ];
  function kbdHTML(m) {
    const tx = m.shift ? (s => s.toUpperCase()) : (s => s);
    const rows = KBD_ROWS.map(r => `<div class="krow">${r.map(k =>
      `<button class="key tap" data-act="kbdKey" data-k="${tx(k)}">${tx(k)}</button>`).join('')}</div>`).join('');
    return `<div class="sheet kbd-sheet">
      <div class="sheet-head"><div class="ttl">${esc(m.title)}</div><button class="x tap" data-act="closeModal">✕</button></div>
      <div class="kbd-disp"><span>${esc(m.value) || '<i>—</i>'}</span><b class="caret"></b></div>
      <div class="kbd">
        ${rows}
        <div class="krow">
          <button class="key wide tap ${m.shift ? 'on' : ''}" data-act="kbdShift">⇧</button>
          <button class="key spc tap" data-act="kbdKey" data-k=" ">espace</button>
          <button class="key wide tap" data-act="kbdBack">⌫</button>
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost tap" data-act="closeModal">Annuler</button>
        <button class="btn coral tap" data-act="kbdOk">Valider</button>
      </div>
    </div>`;
  }
  function kbdKey(k) { const m = state.modal; m.value = (m.value || '') + k; m.shift = false; render(); }
  function kbdBack() { const m = state.modal; m.value = (m.value || '').slice(0, -1); render(); }
  function kbdShift() { const m = state.modal; m.shift = !m.shift; render(); }
  function kbdOk() { const m = state.modal; state.settingsDraft[m.key] = m.value.trim(); state.modal = null; render(); }

  /* ---- historique ---- */
  function buildHistoryRows(sessions, events) {
    const byDate = {};
    for (const s of sessions) { (byDate[s.date] = byDate[s.date] || { date: s.date })[s.type] = s; }
    const sevRank = { mild: 1, moderate: 2, severe: 3 };
    const evByDate = {};
    for (const e of events) { const d = localDateFromTs(e.occurred_at); if (!evByDate[d] || (sevRank[e.severity] || 1) > (sevRank[evByDate[d].severity] || 1)) evByDate[d] = e; }
    for (const d of Object.keys(evByDate)) if (!byDate[d]) byDate[d] = { date: d };
    const dates = Object.keys(byDate).sort().reverse();
    const cell = (r) => r ? `${r.fed_packets != null ? nf(r.fed_packets) + 'pq' : '—'}${r.shot_dose != null ? ' · ' + doseStr(r.shot_dose, false) : ''}` : '—';
    return dates.map(d => {
      const r = byDate[d], ev = evByDate[d];
      return {
        date: frShort(d),
        morning: cell(r.morning),
        snack: r.snack && r.snack.fed_at != null ? nf(r.snack.fed_packets) + 'pq' : '—',
        evening: cell(r.evening),
        event: ev ? ev.type : null,
        glucose: ev && ev.glucose_mgdl != null ? ev.glucose_mgdl : null,
      };
    });
  }
  function historyHTML() {
    const rows = (state.historyRows || []).slice(0, state.histRange === 7 ? 7 : 30);
    return `<div class="hist">
      <div class="hist-head">
        <button class="bk tap" data-act="history-back">←</button>
        <div class="ttl">Historique</div>
        <div class="seg">
          <button class="${state.histRange === 7 ? 'on' : ''}" data-act="histRange" data-arg="7">7 jours</button>
          <button class="${state.histRange === 30 ? 'on' : ''}" data-act="histRange" data-arg="30">30 jours</button>
        </div>
      </div>
      <div class="hist-wrap"><div class="hist-scroll"><table class="htbl">
        <thead><tr><th>Date</th><th>Matin</th><th>Snack</th><th>Soir</th><th>Événement · glycémie</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => `<tr class="${r.event ? 'evt' : ''}"><td><b>${esc(r.date)}</b></td><td>${esc(r.morning)}</td><td class="${r.snack === '—' ? 'muted' : ''}">${esc(r.snack)}</td><td>${esc(r.evening)}</td><td>${r.event ? `<span class="ev-tag ${r.event === 'hyper' ? 'hyper' : ''}">${r.event === 'hypo' ? 'Hypo' : 'Hyper'}</span>${r.glucose != null ? ` <span class="gly-val">${nf(r.glucose)}<small>mg/dL</small></span>` : ''}` : '<span class="muted">—</span>'}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:34px">Aucune donnée pour cette période</td></tr>'}
        </tbody>
      </table></div></div>
    </div>`;
  }

  /* ====================== ACTIONS ====================== */
  let lockedUntil = 0;
  function locked() { const t = Date.now(); if (t < lockedUntil) return true; lockedUntil = t + 1000; return false; } // anti double-clic 1s

  function openFeed() { state.modal = { type: 'feed', sessType: activeType(), initial: 1.5, min: 1, max: 2 }; render(); }
  function openShot() { const t = activeType(); state.modal = { type: 'shot', sessType: t, target: state.settings[t === 'morning' ? 'morning_dose_target' : 'evening_dose_target'] }; render(); }
  function openSnack() { state.modal = { type: 'snack', sessType: 'snack', title: 'Combien pour le snack ?', initial: 0.5, min: 0.25, max: 1 }; render(); }
  function openEvent(type) { state.modal = { type: 'event', evType: type, sel: [], sev: null, mins: 0, notes: '', glucose: '' }; render(); }

  async function doFeedValidate() {
    if (locked()) return;
    const v = parseFloat($('#feedSlide').value);
    const t = state.modal.sessType || 'morning'; const isSnack = t === 'snack';
    state.modal = null;
    try { await API.post('/api/sessions', { type: t, patch: { fed_at: Date.now(), fed_packets: v } }); }
    catch (e) { toast('Erreur d’enregistrement', 'coral'); }
    await safeReload(); render();
    const cat = state.settings.cat_name || 'Ziwa';
    flashMoment(isSnack ? { tone: 'coral', mood: 'happy', t1: 'Snack donné', t2: `${nf(v)} paquet 🐟` } : { tone: 'coral', mood: 'happy', t1: 'Servi !', t2: `${cat} a son repas 🐟` });
  }
  async function doShotValidate(dose, choice) {
    if (locked()) return;
    const t = state.modal.sessType || activeType();
    state.modal = null;
    try { await API.post('/api/sessions', { type: t, patch: { shot_at: Date.now(), shot_dose: dose, shot_dose_choice: choice } }); }
    catch (e) { toast('Erreur d’enregistrement', 'coral'); }
    await safeReload(); render();
    flashMoment({ tone: 'green', mood: 'happy', t1: 'Bien piquée', t2: `${doseStr(dose)} · c’est noté` });
  }

  function askCancel(which) { state.modal = { type: 'confirm', which, text: 'Annuler cette action ?' }; render(); }
  async function confirmYes() {
    const which = state.modal.which, t = activeType();
    state.modal = null;
    const patch = which === 'feed'
      ? { fed_at: null, fed_packets: null, shot_at: null, shot_dose: null, shot_dose_choice: null }
      : { shot_at: null, shot_dose: null, shot_dose_choice: null };
    try { await API.post('/api/sessions', { type: t, patch }); } catch (e) { }
    await safeReload(); render(); toast('Action annulée', 'coral');
  }

  // ---- modale événement : interactions sans re-render (textarea préservée) ----
  function toggleSympt(node, id) {
    const m = state.modal; const i = m.sel.indexOf(id);
    if (i >= 0) m.sel.splice(i, 1); else m.sel.push(id);
    node.classList.toggle('on'); const box = node.querySelector('.box'); if (box) box.textContent = m.sel.includes(id) ? '✓' : '';
    refreshUrg();
  }
  function setSev(node, v) { state.modal.sev = v; $$('.sev .sevbtn').forEach(b => b.classList.remove('on')); node.classList.add('on'); refreshUrg(); }
  function refreshUrg() { const slot = $('#urgSlot'); if (slot) slot.innerHTML = eventDanger(state.modal) ? urgBanner(state.modal.evType) : ''; }
  function stepEvTime(d) {
    const m = state.modal; m.mins = Math.min(0, m.mins + d);
    const t = new Date(state.now + m.mins * 60000);
    const tv = $('#evTime'); if (tv) tv.textContent = pad(t.getHours()) + 'h' + pad(t.getMinutes());
    const rel = $('#evTimeRel'); if (rel) rel.textContent = m.mins === 0 ? 'maintenant' : 'il y a ' + (-m.mins) + ' min';
  }

  async function eventSubmit() {
    if (locked()) return;
    const m = state.modal; const occurred_at = state.now + m.mins * 60000;
    let ev;
    const glucose_mgdl = (m.glucose === '' || m.glucose == null || !Number.isFinite(Number(m.glucose))) ? null : Number(m.glucose);
    try { ev = await API.post('/api/events', { type: m.evType, severity: m.sev || 'mild', symptoms: m.sel, glucose_mgdl, notes: m.notes, occurred_at }); }
    catch (e) { toast('Erreur d’enregistrement', 'coral'); return; }
    toast('Événement enregistré', 'coral');
    state.modal = { type: 'analysis', event: ev, phase: 'loading' }; render();
    runAnalysis(ev.id);
  }
  async function runAnalysis(id) {
    try {
      const res = await API.post('/api/analyze', { event_id: id });
      if (state.modal && state.modal.type === 'analysis') { state.modal.phase = 'result'; state.modal.res = res; render(); }
    } catch (e) {
      if (state.modal && state.modal.type === 'analysis') { state.modal.phase = 'error'; state.modal.err = e; render(); }
    }
  }
  function retryAnalysis() { if (!state.modal || !state.modal.event) return; state.modal.phase = 'loading'; render(); runAnalysis(state.modal.event.id); }

  async function applyReco() {
    const m = state.modal; if (m.applied || locked()) return;
    const reco = m.res.recommandation_dose;
    const moments = reco.moment === 'both' ? ['morning', 'evening'] : [reco.moment];
    try {
      for (const mo of moments) await API.post('/api/dose-change', { moment: mo, new_dose: reco.nouveau_ui, reason: 'ai_suggested' });
      m.applied = true; await safeReload(); render();
      toast(`Dose ${reco.moment === 'morning' ? 'matin' : reco.moment === 'evening' ? 'soir' : 'matin & soir'} : ${nf(reco.ancien_ui)} → ${doseStr(reco.nouveau_ui)}`, 'green');
    } catch (e) { toast('Échec de l’application', 'coral'); }
  }

  async function saveSettings() {
    const patch = { ...state.settingsDraft };
    const tg = $('#snackToggle'); if (tg) patch.snack_enabled = tg.classList.contains('on');
    try { state.settings = await API.post('/api/settings', patch); state.settingsDraft = { ...state.settings }; toast('Réglages enregistrés', 'green'); render(); }
    catch (e) { toast('Échec de l’enregistrement', 'coral'); }
  }
  function toggleSnackSetting(node) { node.classList.toggle('on'); state.settingsDraft.snack_enabled = node.classList.contains('on'); const lbl = $('#snackLbl'); if (lbl) lbl.textContent = node.classList.contains('on') ? 'Activé' : 'Désactivé'; }
  function exportCsv() { const a = document.createElement('a'); a.href = '/api/export.csv?days=90'; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); toast('Export CSV (90 jours)', 'coral'); }

  async function openHistory() {
    try {
      const [sessions, events] = await Promise.all([API.get('/api/sessions?days=30'), API.get('/api/events?days=30')]);
      state.historyRows = buildHistoryRows(sessions, events);
    } catch (e) { state.historyRows = []; }
    state.histRange = 30; state.view = 'history'; render(); poke();
  }

  // ---- toast / moment ----
  let toastTimer = null;
  function toast(text, tone) { state.toast = { text, tone }; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { state.toast = null; render(); }, 2200); }
  function flashMoment(mo) { state.moment = mo; render(); setTimeout(() => { state.moment = null; render(); }, 1350); }

  async function safeReload() { try { await loadState(); } catch (e) { state.now = nowTs(); } }

  /* ---- dispatcher de clics (délégation, attaché une seule fois) ---- */
  function onClick(e) {
    const node = e.target.closest('[data-act]'); if (!node) return;
    const act = node.dataset.act, arg = node.dataset.arg;
    switch (act) {
      case 'feed': openFeed(); break;
      case 'shot': openShot(); break;
      case 'snack': openSnack(); break;
      case 'alarm': openEvent(arg); break;
      case 'cancel': askCancel(arg); break;
      case 'settings': state.settingsDraft = { ...state.settings }; state.view = 'settings'; render(); poke(); break;
      case 'back': state.view = 'main'; render(); poke(); break;
      case 'history': openHistory(); break;
      case 'history-back': state.view = 'settings'; render(); poke(); break;
      case 'histRange': state.histRange = parseInt(arg, 10); render(); break;
      case 'closeModal': state.modal = null; render(); break;
      case 'feedValidate': doFeedValidate(); break;
      case 'shotValidate': doShotValidate(parseFloat(node.dataset.dose), node.dataset.choice); break;
      case 'sympt': toggleSympt(node, node.dataset.id); break;
      case 'sev': setSev(node, node.dataset.v); break;
      case 'evtime': stepEvTime(parseInt(node.dataset.d, 10)); break;
      case 'eventSubmit': eventSubmit(); break;
      case 'retryAnalysis': retryAnalysis(); break;
      case 'applyReco': applyReco(); break;
      case 'confirmYes': confirmYes(); break;
      case 'saveSettings': saveSettings(); break;
      case 'snackToggle': toggleSnackSetting(node); break;
      case 'exportCsv': exportCsv(); break;
      case 'setField': openPicker(node.dataset.key); break;
      case 'wheelTap': wheelTap(node); break;
      case 'wheelValidate': wheelValidate(); break;
      case 'kbdKey': kbdKey(node.dataset.k); break;
      case 'kbdBack': kbdBack(); break;
      case 'kbdShift': kbdShift(); break;
      case 'kbdOk': kbdOk(); break;
      case 'wake': wake(); break;
    }
    poke();
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.in === 'feed') updateFeedDisplay(t);
    else if (t.dataset.in === 'notes' && state.modal) state.modal.notes = t.value;
    else if (t.dataset.in === 'glucose' && state.modal) {
      state.modal.glucose = t.value;
      const z = glyZone(t.value), slot = $('#glyZone');
      if (slot) slot.innerHTML = `<b class="z-${z.cls}">${z.txt}</b>`;
    }
  }
  function updateFeedDisplay(slider) {
    const v = parseFloat(slider.value);
    $('#feedN').textContent = nf(v); $('#feedU').textContent = 'paquet' + (v > 1 ? 's' : '');
    const grams = Math.round(v * state.settings.food_packet_weight_g), kcal = Math.round(grams / 100 * state.settings.food_kcal_per_100g);
    $('#feedCalc').textContent = `≈ ${grams} g · ≈ ${kcal} kcal`;
    $$('#feedTicks span').forEach(s => s.classList.toggle('on', parseFloat(s.dataset.t) === v));
  }

  /* ---- écran de veille (économiseur, 5 min d'inactivité) ---- */
  let idleTimer = null;
  function poke() { if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(() => { state.saver = true; render(); }, 300000); }
  function wake() { if (state.saver) { state.saver = false; render(); } poke(); }

  /* ---- mise à l'échelle (preview desktop vs kiosque 800×480) ---- */
  function fit() {
    const dev = $('#device'); if (!dev) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const kiosk = vw <= 824 && vh <= 504;
    document.body.classList.toggle('kiosk', kiosk);
    if (kiosk) { const s = Math.min(vw / 800, vh / 480); dev.style.transform = s < 0.999 ? `scale(${s})` : 'none'; }
    else { const s = clamp(Math.min((vw - 28) / 800, (vh - 28) / 480), 0.3, 2); dev.style.transform = `scale(${s})`; }
  }

  /* ---- horloge / rafraîchissement / changement de jour ---- */
  function startTick() {
    if (state.qa) return; // mode QA figé (preview/view/modal/now) : pas de polling
    setInterval(async () => {
      state.now = nowTs();
      const d = localDateNow();
      if (d !== state.today) { await safeReload(); render(); return; } // passage à minuit
      if (state.view === 'main' && !state.modal && !state.saver) { await safeReload(); render(); }
    }, 20000);
  }

  /* ---- init + paramètres QA/captures (lecture seule) ---- */
  // ?preview=tofeed|toshot|late|done|snack · ?view=settings|history · ?modal=feed|shot|snack|hypo|hyper|analysis
  const DEMO_ANALYSIS = {
    urgence_veterinaire: false, niveau_alerte: 'attention',
    analyse_synthese: 'Trois épisodes d’hypoglycémie en 10 jours, toujours le matin entre 10h et 11h. La dose du matin paraît un peu forte pour la quantité donnée.',
    hypotheses: ['Sous-alimentation matinale (1 paquet vs 1,5 le soir)', 'Effet Somogyi possible : à confirmer par une courbe vétérinaire'],
    recommandation_dose: { ajuster: true, moment: 'morning', ancien_ui: 2, nouveau_ui: 1.5, justification: 'Réduire la dose du matin de 0,5 UI et maintenir 7 jours avant réévaluation.' },
    actions_immediates: ['Vérifier que Ziwa mange avant chaque piqûre', 'Surveiller le comportement ce soir', 'Noter l’heure exacte du prochain épisode'],
    rappel_veto: 'Ces suggestions ne remplacent pas un avis vétérinaire. Consultation conseillée vu la récurrence.',
  };
  function parseQA() {
    const q = new URLSearchParams(location.search);
    state.preview = (q.get('preview') || '').toLowerCase() || null;
    state.qaView = (q.get('view') || '').toLowerCase() || null;
    state.qaModal = (q.get('modal') || '').toLowerCase() || null;
    // ?now=HH:MM — fige l'heure pour démontrer la fenêtre (ex. 18:00 pour une cible 20h)
    const nowM = (q.get('now') || '').match(/^(\d{1,2}):(\d{2})$/);
    if (nowM) { const d = new Date(); d.setHours(+nowM[1], +nowM[2], 0, 0); state.nowOffset = d.getTime() - Date.now(); }
    state.qaSaver = q.get('saver') === '1';   // ?saver=1 — forcer l'écran de veille (capture)
    state.qa = !!(state.preview || state.qaView || state.qaModal || nowM || state.qaSaver);
  }
  async function applyQA() {
    if (state.qaView === 'settings') { state.settingsDraft = { ...state.settings }; state.view = 'settings'; }
    else if (state.qaView === 'history') {
      try { const [s, e] = await Promise.all([API.get('/api/sessions?days=30'), API.get('/api/events?days=30')]); state.historyRows = buildHistoryRows(s, e); } catch (_) { }
      state.view = 'history';
    }
    const md = state.qaModal;
    if (md === 'feed') openFeed();
    else if (md === 'shot') openShot();
    else if (md === 'snack') openSnack();
    else if (md === 'hypo' || md === 'hyper') {
      openEvent(md);
      // pré-remplissage QA optionnel : ?gly=45&sev=moderate
      const q = new URLSearchParams(location.search);
      if (q.get('gly')) state.modal.glucose = q.get('gly');
      if (q.get('sev')) state.modal.sev = q.get('sev');
    }
    else if (md === 'analysis') state.modal = { type: 'analysis', event: { type: 'hypo', glucose_mgdl: 48 }, phase: 'result', res: DEMO_ANALYSIS };
    // QA pickers : ?view=settings&pick=KEY (roue) ou &kbd=KEY (clavier)
    const q2 = new URLSearchParams(location.search);
    if (state.qaView === 'settings' && q2.get('pick')) openPicker(q2.get('pick'));
    if (state.qaView === 'settings' && q2.get('kbd')) openPicker(q2.get('kbd'));
    if (state.qaSaver) state.saver = true;
  }
  async function init() {
    parseQA();
    // Démarrage résilient : si le serveur n'est pas encore prêt (lancement via .bat,
    // boot du Pi…), on réessaie quelques secondes avant d'afficher une erreur.
    let ok = false;
    for (let i = 0; i < 15 && !ok; i++) {
      try { await loadState(); ok = true; }
      catch (e) {
        $('#device').innerHTML = `<div class="boot-err"><div class="ic">⏳</div><div class="lab">Connexion au serveur…</div><div class="sub">Démarrage en cours, merci de patienter.</div></div>`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!ok) {
      $('#device').innerHTML = `<div class="boot-err"><div class="ic">🔌</div><div class="lab">Serveur injoignable</div><div class="sub">Vérifie que le backend tourne (« npm start » ou Lancer-Ziwa.bat) puis recharge la page.</div></div>`;
      return;
    }
    const dev = $('#device');
    dev.addEventListener('click', onClick);
    dev.addEventListener('input', onInput);
    document.addEventListener('pointerdown', () => poke(), { passive: true });
    window.addEventListener('resize', fit);
    await applyQA();
    fit(); render(); poke(); startTick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
