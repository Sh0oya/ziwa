# Installation de Ziwa sur un autre PC (Windows)

Guide pour lancer l'app sur un PC portable **qui n'a rien d'installé**.
Pour Windows. (Le `.bat` est Windows ; sous Mac/Linux, voir tout en bas.)

---

## ⚡ Version courte (3 étapes)

1. **Installer Node.js** (une seule fois) : https://nodejs.org → bouton **LTS** → installer (Suivant partout).
2. **Copier le dossier du projet** sur le Pz portable (clé USB, OneDrive, zip…). Voir la liste exacte plus bas.
3. **Double-cliquer sur `Lancer-Ziwa.bat`**. Au 1er lancement il installe tout seul les dépendances, puis ouvre l'app dans le navigateur.

C'est tout. Pour l'analyse IA en plus, voir « Clé API » plus bas.

---

## 1. Pré-requis : Node.js

C'est le **seul logiciel** à installer manuellement.

- Aller sur **https://nodejs.org/**
- Télécharger la version **LTS** (recommandée). Testé avec **Node.js 22 LTS**, fonctionne avec Node **18+**.
- Lancer l'installeur, cliquer **Suivant / Next** jusqu'au bout (garder les options par défaut).
- Redémarrer le PC si l'installeur le demande.

> Pourquoi : l'app est en Node.js (JavaScript côté serveur). `npm` (le gestionnaire de
> paquets) est inclus avec Node.js — rien d'autre à installer.

Pas besoin de Python, ni de compilateur : la dépendance native `better-sqlite3` est
téléchargée **pré-compilée** pour Windows + Node 22.

---

## 2. Fichiers à copier sur le PC portable

Copie **tout le dossier** `diabete-chat` **SAUF** ces deux dossiers, inutiles et lourds
(ils seront recréés automatiquement) :

- ❌ `node_modules/`  → réinstallé par le `.bat` (dépend du PC)
- ❌ `data/`          → la base de données locale (sera recréée ; à copier seulement si tu veux **garder l'historique**)

### Liste exacte des fichiers nécessaires

```
diabete-chat/
├── Lancer-Ziwa.bat        ← double-clic pour lancer
├── INSTALLATION.md        ← ce fichier
├── README.md
├── package.json           ← « requirements » (liste des dépendances + versions)
├── package-lock.json      ← versions verrouillées (à copier si présent)
├── .env.example
├── server.js
├── db.js
├── ai.js
├── seed.js
├── vet-rules.md
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── fonts.css
    └── fonts/             ← les .woff2 (l'app marche hors-ligne)
```

> Astuce simple : zippe le dossier complet, supprime `node_modules` et `data` du zip,
> transfère, dézippe. Ou copie tout : le `.bat` régénère ce qu'il faut.

---

## 3. Lancer

Double-clic sur **`Lancer-Ziwa.bat`**. Au premier lancement il va :

1. vérifier que Node.js est là (sinon il te donne le lien),
2. installer les dépendances (`npm install`, 1–3 min, **internet requis cette fois-ci**),
3. créer le fichier `.env` et une base de démonstration,
4. démarrer le serveur (fenêtre « Serveur Ziwa » — **à laisser ouverte**),
5. ouvrir **http://localhost:3000** dans le navigateur.

Les lancements suivants sont **instantanés** et fonctionnent **sans internet**
(sauf l'analyse IA, qui appelle Claude).

**Pour arrêter** : ferme la fenêtre noire « Serveur Ziwa ».
**Plein écran (mode kiosque)** : touche **F11** dans le navigateur.

---

## 4. (Optionnel) Clé API pour l'analyse IA

Tout marche sans clé, **sauf** le bouton « Analyser IA » des événements hypo/hyper
(l'événement est quand même enregistré, et l'analyse est relançable plus tard).

Pour activer l'IA :

1. Récupère une clé sur https://console.anthropic.com/ (format `sk-ant-...`).
2. Ouvre le fichier **`.env`** (avec le Bloc-notes) dans le dossier du projet.
3. Remplace la ligne par : `CLAUDE_API_KEY=sk-ant-ta-vraie-cle`
4. Enregistre, puis relance `Lancer-Ziwa.bat`.

> La clé reste **uniquement sur le PC** (côté serveur) et n'est jamais envoyée au navigateur.

---

## 5. « Requirements » complet (référence technique)

L'équivalent Node.js d'un `requirements.txt`, c'est **`package.json`**. Versions testées :

| Composant | Version testée | Rôle |
|---|---|---|
| Node.js | 22.17.0 (LTS) | moteur d'exécution (inclut npm) |
| npm | 11.x | installe les dépendances |
| express | ^4.22.2 | serveur HTTP / API |
| better-sqlite3 | ^11.10.0 | base de données SQLite locale |
| dotenv | ^16.6.1 | lecture du fichier `.env` |

Installation manuelle équivalente (si tu n'utilises pas le `.bat`) :

```bat
cd chemin\vers\diabete-chat
npm install
copy .env.example .env
npm run seed        REM optionnel : données de démo
npm start           REM puis ouvrir http://localhost:3000
```

Commandes utiles :

| Commande | Effet |
|---|---|
| `npm start` | démarre le serveur (port 3000) |
| `node server.js 3010` | démarre sur un autre port (ex. 3010) |
| `npm run seed` | (ré)injecte des données de démonstration |
| `npm run seed:reset` | vide puis réinjecte les données de démo |

---

## 6. Problèmes courants

- **« Node.js n'est pas installé »** → installe Node.js LTS (étape 1) puis relance le `.bat`.
- **La page affiche « Connexion au serveur… »** → normal au démarrage ; ça se connecte tout seul en 1–2 s. Si ça reste bloqué, vérifie que la fenêtre « Serveur Ziwa » est bien ouverte.
- **« Port 3000 déjà utilisé »** → un autre programme occupe le port. Ferme-le, ou lance `node server.js 3010` et ouvre `http://localhost:3010`.
- **`npm install` échoue** → vérifie la connexion internet (nécessaire seulement à la 1ʳᵉ installation).
- **Antivirus bloque le `.bat`** → clic droit → Propriétés → cocher « Débloquer », ou lancer les commandes de la section 5 à la main.

---

## 7. Sous Mac / Linux (sans le .bat)

```bash
# installer Node.js LTS (https://nodejs.org ou via le gestionnaire de paquets)
cd diabete-chat
npm install
cp .env.example .env      # puis renseigner CLAUDE_API_KEY si besoin
npm run seed              # optionnel
npm start                 # ouvrir http://localhost:3000
```
