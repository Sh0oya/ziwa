# Ziwa — suivi du diabète félin 🐟

Application de coordination du suivi d'un chat diabétique pour un foyer, pensée
pour un **kiosque mural en cuisine** : Raspberry Pi 5 + écran tactile 7" 800×480,
Chromium plein écran. Elle remplace les post-its sur le frigo : on voit en passant
ce qui est fait (nourrie ? piquée ?), on évite les oublis et les doublons, et on
obtient une analyse IA en cas d'épisode hypo/hyper.

- **Design** : « Direction B — Bloc » (crème + corail + jaune, illustrations du chat **Ziwa**).
- **Frontend** : HTML/CSS/JS **vanilla**, un seul écran 800×480, **aucun scroll**, cibles tactiles ≥ 60 px. Pas de framework, pas de build step.
- **Backend** : Node.js + Express.
- **Stockage** : SQLite (`better-sqlite3`), fichier local `data/tracker.db`.
- **IA** : appel direct à l'API Anthropic Claude depuis le backend (clé dans `.env`, jamais exposée au navigateur).

---

## Arborescence

```
.
├── server.js          # Backend Express (sert public/ + API JSON)
├── db.js              # Initialisation SQLite + requêtes
├── ai.js              # Wrapper appel Claude (fetch natif, JSON strict)
├── vet-rules.md       # Règles vétérinaires injectées dans le prompt système
├── seed.js            # Données de démonstration
├── package.json
├── .env.example       # CLAUDE_API_KEY=…
├── data/
│   └── tracker.db     # Base SQLite (créée au runtime)
├── public/
│   ├── index.html     # Page kiosque
│   ├── styles.css     # Tout le design
│   ├── app.js         # Logique frontend (vanilla)
│   ├── fonts.css      # @font-face Fredoka + Caveat (auto-hébergés)
│   └── fonts/         # Polices .woff2 — l'app s'affiche correctement HORS-LIGNE
└── screenshots/       # Captures des vues principales en 800×480
```

> Les fichiers `*.jsx`, `app-bundle.jsx`, `design-canvas.jsx` et les `index.html` /
> `styles.css` **à la racine** sont le prototype de design React d'origine (canevas
> de conception). Ils ne sont pas utilisés par l'application : tout le frontend livré
> se trouve dans `public/`. Les polices sont auto-hébergées (`public/fonts/`) pour que
> le kiosque reste lisible même sans connexion internet.

---

## Démarrage rapide (poste de dev)

```bash
npm install
cp .env.example .env          # puis renseigner CLAUDE_API_KEY (Windows: copy .env.example .env)
npm run seed                  # données de démonstration (facultatif)
npm start                     # http://localhost:3000
```

Sans clé API, tout fonctionne **sauf** l'analyse IA : l'événement est quand même
enregistré et l'écran propose de relancer l'analyse plus tard.

---

## Modèle de données (SQLite)

- `settings(key, value)` — réglages (cf. valeurs par défaut dans `db.js`).
- `sessions(date, type, fed_at, fed_packets, shot_at, shot_dose, shot_dose_choice, notes)` — une ligne par (jour, `morning`/`snack`/`evening`).
- `events(occurred_at, type, symptoms, severity, glucose_mgdl, ai_analysis, notes)` — épisodes hypo/hyper (`glucose_mgdl` = glycémie mesurée au glucomètre, optionnelle).
- `dose_history(changed_at, moment, old_dose, new_dose, reason)` — journal des ajustements de dose.

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET  | `/api/state` | Tout pour la vue principale (réglages + sessions du jour + dernière piqûre) |
| GET  | `/api/settings` · POST `/api/settings` | Lire / écrire les réglages |
| GET  | `/api/sessions?date=today` | Sessions du jour |
| GET  | `/api/sessions?days=30` | Historique |
| POST | `/api/sessions` | Enregistrer/annuler une action `{date?, type, patch}` |
| POST | `/api/events` · GET `/api/events?days=30` | Créer / lister des événements |
| POST | `/api/analyze` | Analyse IA d'un événement `{event_id}` |
| POST | `/api/dose-change` | Appliquer un changement de dose `{moment, new_dose, reason}` |
| GET  | `/api/export.csv?days=90` | Export CSV : sessions **+ événements glycémiques** (glycémie, sévérité, symptômes). Séparateur `;` + BOM, prêt pour Excel/Numbers |

---

## Réglage initial sans clavier

Les champs texte (prénom, insuline, marque) se renseignent le plus simplement avec
un clavier branché le temps de la configuration **ou** depuis un autre appareil du
réseau local (ouvrir `http://<ip-du-pi>:3000` puis l'écran Réglages). Au quotidien,
aucune saisie clavier n'est nécessaire : tout est tactile.

## QA / captures d'écran

Des paramètres d'URL (lecture seule, n'écrivent jamais en base, désactivent le
polling) permettent de visualiser n'importe quel écran/état sans attendre la bonne
heure — pratique pour tester sur l'écran réel ou refaire les captures :

```
?preview=tofeed|toshot|late|done|snack   état de la vue d'accueil
?view=settings|history                    ouvrir Réglages ou Historique
?modal=feed|shot|snack|hypo|hyper|analysis  ouvrir une modale
?modal=hypo&gly=45&sev=moderate           pré-remplir glycémie + sévérité (démo)
?now=HH:MM                                figer l'heure (démontrer la fenêtre)
```

Exemples :
- `http://localhost:3000/?modal=analysis` — modale d'analyse IA (résultat de démo, sans clé API).
- `http://localhost:3000/?now=18:00` — voir l'écran tel qu'il sera à 18h (utile pour
  vérifier qu'on peut déjà agir à H-2 d'une cible à 20h). Lecture seule : `?now=`
  n'influence que l'affichage et la logique de fenêtre, **jamais** les horodatages
  réellement écrits en base (une action faite à 18h est bien enregistrée à 18h réel).

Les captures du dossier `screenshots/` ont été générées ainsi en 800×480.

---

## Installation kiosque sur le Raspberry Pi 5

```bash
# 1. Node.js LTS + Chromium
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs chromium-browser unclutter git

# 2. Récupérer le projet
cd /home/pi
git clone <repo> diabete-chat
cd diabete-chat
npm install --omit=dev
cp .env.example .env
nano .env                    # ajouter CLAUDE_API_KEY
npm run seed                 # facultatif : données d'exemple

# 3. Service systemd pour le backend (démarre au boot, redémarre après crash)
sudo tee /etc/systemd/system/diabete-chat.service >/dev/null <<'UNIT'
[Unit]
Description=Ziwa — backend suivi diabète félin
After=network.target

[Service]
WorkingDirectory=/home/pi/diabete-chat
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
User=pi
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now diabete-chat
```

### Chromium en mode kiosque au démarrage

```bash
mkdir -p /home/pi/.config/autostart
tee /home/pi/.config/autostart/ziwa-kiosk.desktop >/dev/null <<'DESK'
[Desktop Entry]
Type=Application
Name=Ziwa Kiosk
Exec=chromium-browser --kiosk --incognito --disable-infobars --noerrdialogs --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000 http://localhost:3000
X-GNOME-Autostart-enabled=true
DESK
```

### Désactiver la mise en veille de l'écran

```bash
sudo nano /etc/lightdm/lightdm.conf
# sous [Seat:*] :
# xserver-command=X -s 0 -dpms
```

`unclutter` masque le curseur. L'app gère elle-même un économiseur d'écran
(assombrissement après 5 min d'inactivité, réveil au toucher) ; vous pouvez
combiner avec une extinction matérielle du rétroéclairage si souhaité.

---

## Comportements implémentés

- **Tout est dynamique selon les réglages** : l'**unité de dose** (`dose_unit`, ex.
  « UI », « U. », « unités ») est éditable dans Réglages et se propage partout —
  écran d'accueil, boutons, modale de piqûre, historique, analyse IA et prompt envoyé
  à Claude. De même, horaires, doses cibles, tolérance et données nutritionnelles
  pilotent l'affichage et les calculs sans rien coder en dur.
- **Glycémie mesurée (mg/dL)** : la modale hypo/hyper propose un champ « Glycémie
  mesurée (si glucomètre) » avec repère visuel temps réel (hypo / normal / élevée /
  hyper). La valeur est stockée (`events.glucose_mgdl`), affichée dans l'analyse,
  transmise à l'IA avec les repères félins (hypo < 60 ; normal ~80–120 ; hyper > 300),
  reprise dans la **vue Historique** (colonne « Événement · glycémie ») et dans
  l'**export CSV** (colonnes Événement / Glycémie (mg/dL) / Sévérité / Symptômes) —
  prêt à montrer au vétérinaire.
- **Snack « en avance »** : comme les piqûres, le snack est actionnable dès **H-1**
  (fenêtre cible ± 1 h, ex. 12h–14h pour une cible à 13h). On peut donc le donner en
  avance ; passé la fenêtre sans l'avoir donné, l'app bascule sur le soir et le note
  « non donné » en gris dans le journal.
- **Fenêtre d'action H-2 / H+2** : chaque session (matin, soir) est « ouverte »
  dès **2 h avant l'heure cible** et le reste jusqu'à **2 h après** (tolérance
  réglable). Concrètement, pour une piqûre prévue à 20h, on peut déjà nourrir et
  piquer dès 18h — l'app affiche alors « En avance · cible 20h » mais n'empêche
  rien. Avant la fenêtre : état bleu « Prochaine piqûre dans … ». Après : état
  rouge « Retard de … ». La session active suit ces fenêtres (pas des tranches
  horaires fixes), donc elle reste correcte même si vous changez les heures.
- **Anti-double-clic** : un appui sur un bouton d'action est ignoré pendant 1 s.
- **Annulation** : appuyer sur une action déjà validée demande confirmation.
- **Changement de jour** : à minuit, l'app recharge et repart sur la session du matin.
- **Heure d'été/hiver** : tout est en heure locale (`Date`), géré automatiquement.
- **Réseau perdu** : l'événement est enregistré localement, l'analyse IA est relançable plus tard.
- **Économiseur d'écran** : assombrissement après 5 min, réveil au toucher.
- **Export CSV** : 90 derniers jours, exploitable Excel/Numbers.
- **Robustesse** : SQLite en mode WAL (résiste aux coupures), backend relancé par systemd.

## Sécurité

Aucune authentification (kiosque domestique, réseau local). La clé API Claude
reste **côté serveur uniquement** (lue depuis `.env`, jamais envoyée au navigateur).
