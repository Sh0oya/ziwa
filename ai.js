'use strict';
// ai.js — wrapper d'appel à l'API Claude pour l'analyse d'un événement glycémique.
// Lit vet-rules.md, l'injecte dans le prompt système, construit le message
// utilisateur à partir des données SQLite, et renvoie un JSON strict validé.
// Utilise fetch natif (Node 18+) — aucune dépendance supplémentaire.

const fs = require('fs');
const path = require('path');

const VET_RULES = (() => {
  try { return fs.readFileSync(path.join(__dirname, 'vet-rules.md'), 'utf8'); }
  catch { return '(règles vétérinaires indisponibles)'; }
})();

const SYSTEM_PROMPT = `Tu es un assistant IA spécialisé dans le suivi du diabète félin. Tu analyses les données de suivi quotidien d'un chat diabétique pour identifier des patterns et proposer des ajustements prudents.

${VET_RULES}

CONTRAINTES STRICTES DE TON RÔLE :
1. Tu n'es PAS un vétérinaire. Tu suggères, tu n'ordonnes jamais. Toutes tes réponses incluent un rappel d'orientation vétérinaire si l'événement le justifie.
2. Tes recommandations d'ajustement de dose ne dépassent JAMAIS 0,5 UI en valeur absolue.
3. Tu n'ajustes pas si moins de 7 jours se sont écoulés depuis le dernier changement de dose.
4. Avant toute suggestion d'augmentation de dose, tu mentionnes l'effet Somogyi comme hypothèse alternative.
5. Tu refuses de répondre en cas de données insuffisantes (moins de 5 jours d'historique).

TU RÉPONDS UNIQUEMENT EN JSON STRICT, sans markdown, sans backticks, sans texte avant ou après. Format exact :
{
  "urgence_veterinaire": boolean,
  "niveau_alerte": "info" | "attention" | "urgent",
  "analyse_synthese": "string en français, max 200 caractères",
  "hypotheses": ["string", "string", ...] (max 3),
  "recommandation_dose": {
    "ajuster": boolean,
    "moment": "morning" | "evening" | "both" | null,
    "ancien_ui": number,
    "nouveau_ui": number,
    "justification": "string en français, max 150 caractères"
  },
  "actions_immediates": ["string", ...] (max 4, en français, impératif),
  "rappel_veto": "string en français, max 150 caractères"
}
Si tu ne peux pas analyser (données insuffisantes), retourne :
{
  "urgence_veterinaire": false,
  "niveau_alerte": "info",
  "analyse_synthese": "Pas assez de données pour une analyse fiable",
  "hypotheses": [],
  "recommandation_dose": { "ajuster": false, "moment": null, "ancien_ui": 0, "nouveau_ui": 0, "justification": "" },
  "actions_immediates": ["Continuer le suivi pendant au moins 7 jours"],
  "rappel_veto": "Consulter le véto si les symptômes persistent"
}`;

const INSUFFICIENT = {
  urgence_veterinaire: false,
  niveau_alerte: 'info',
  analyse_synthese: 'Pas assez de données pour une analyse fiable',
  hypotheses: [],
  recommandation_dose: { ajuster: false, moment: null, ancien_ui: 0, nouveau_ui: 0, justification: '' },
  actions_immediates: ['Continuer le suivi pendant au moins 7 jours'],
  rappel_veto: 'Consulter le véto si les symptômes persistent',
};

function buildUserMessage({ event, settings, sessions, doseHistory, previousEvents }) {
  const sym = Array.isArray(event.symptoms) ? event.symptoms : [];
  const U = settings.dose_unit || 'UI';
  const g = event.glucose_mgdl;
  const glyLine = (g === null || g === undefined || g === '') ? 'non mesurée'
    : `${g} mg/dL (repères félins : hypo < 60 ; normal ~80–120 ; hyper > 300 au nadir)`;
  return `Événement signalé : ${event.type === 'hypo' ? 'HYPOGLYCÉMIE' : event.type === 'hyper' ? 'HYPERGLYCÉMIE' : 'AUTRE'}
Sévérité ressentie : ${event.severity || 'non précisée'}
Glycémie mesurée : ${glyLine}
Symptômes : ${sym.length ? sym.join(', ') : 'aucun coché'}
Heure : ${new Date(event.occurred_at).toLocaleString('fr-FR')}

Profil du chat :
- Poids : ${settings.cat_weight_kg} kg
- Insuline : ${settings.insulin_type}
- Unité de dose : ${U}
- Dose cible actuelle matin : ${settings.morning_dose_target} ${U}
- Dose cible actuelle soir : ${settings.evening_dose_target} ${U}

Aliment (référence pour calculs caloriques) :
- ${settings.food_brand}
- ${settings.food_kcal_per_100g} kcal / 100g
- ${settings.food_protein_pct}% protéines, ${settings.food_fat_pct}% lipides, ${settings.food_carbs_pct}% glucides, ${settings.food_humidity_pct}% humidité
- Poids paquet : ${settings.food_packet_weight_g}g
- Besoin théorique : ${Math.round(settings.cat_weight_kg * 50)} kcal/jour

Historique des 30 derniers jours (sessions) :
${JSON.stringify(sessions, null, 2)}

Historique des doses (changements) :
${JSON.stringify(doseHistory, null, 2)}

Événements précédents (30j) :
${JSON.stringify(previousEvents, null, 2)}

Question : Quelle est l'analyse de cet événement ? Y a-t-il un pattern visible sur les 30 derniers jours ? Une recommandation d'ajustement de dose est-elle pertinente, et si oui laquelle (en respectant les règles vétérinaires) ?`;
}

// Extrait le premier objet JSON d'un texte, même si entouré de fences/markdown.
function extractJson(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Aucun JSON trouvé dans la réponse');
  return JSON.parse(t.slice(start, end + 1));
}

// Normalise + garde-fous (clamp dose ≤ 0,5 UI, niveaux valides, tailles de listes).
function normalize(raw) {
  const out = { ...INSUFFICIENT, ...raw };
  const niveaux = ['info', 'attention', 'urgent'];
  if (!niveaux.includes(out.niveau_alerte)) out.niveau_alerte = 'attention';
  out.urgence_veterinaire = !!out.urgence_veterinaire;
  out.hypotheses = Array.isArray(out.hypotheses) ? out.hypotheses.slice(0, 3) : [];
  out.actions_immediates = Array.isArray(out.actions_immediates) ? out.actions_immediates.slice(0, 4) : [];
  const r = out.recommandation_dose || {};
  const ancien = Number(r.ancien_ui) || 0;
  let nouveau = Number(r.nouveau_ui) || ancien;
  // Règle vétérinaire : jamais plus de 0,5 UI de variation.
  if (Math.abs(nouveau - ancien) > 0.5) nouveau = ancien + Math.sign(nouveau - ancien) * 0.5;
  out.recommandation_dose = {
    ajuster: !!r.ajuster && nouveau !== ancien,
    moment: ['morning', 'evening', 'both'].includes(r.moment) ? r.moment : null,
    ancien_ui: ancien,
    nouveau_ui: nouveau,
    justification: String(r.justification || ''),
  };
  return out;
}

// Nombre de jours distincts couverts par l'historique des sessions.
function distinctDays(sessions) {
  return new Set((sessions || []).map(s => s.date)).size;
}

async function analyzeEvent({ event, settings, sessions, doseHistory, previousEvents }) {
  // Garde-fou local : données insuffisantes → pas d'appel API.
  if (distinctDays(sessions) < 5) return INSUFFICIENT;

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  if (!apiKey || apiKey.startsWith('sk-ant-xxxx')) {
    const e = new Error('CLAUDE_API_KEY manquante ou non configurée'); e.code = 'no_api_key'; throw e;
  }

  const userMessage = buildUserMessage({ event, settings, sessions, doseHistory, previousEvents });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        // Le prompt système (long, avec les règles véto) est mis en cache.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    const e = new Error(err.name === 'AbortError' ? 'Délai dépassé' : 'Réseau indisponible');
    e.code = 'network'; throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const e = new Error(`API Claude ${resp.status}: ${body.slice(0, 200)}`);
    e.code = resp.status === 401 ? 'no_api_key' : 'api_error';
    throw e;
  }

  const data = await resp.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  try {
    return normalize(extractJson(text));
  } catch (err) {
    const e = new Error('Réponse IA illisible'); e.code = 'parse_error'; e.raw = text; throw e;
  }
}

module.exports = { analyzeEvent, buildUserMessage, SYSTEM_PROMPT, INSUFFICIENT };
