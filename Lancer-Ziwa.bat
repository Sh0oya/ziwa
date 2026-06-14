@echo off
chcp 65001 >nul
title Ziwa - Suivi diabete felin
cd /d "%~dp0"

echo(
echo  ============================================================
echo    Ziwa - Suivi du diabete felin de Ziwa
echo  ============================================================
echo(

REM --- 1) Verifier que Node.js est installe ---------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js n'est pas installe sur ce PC.
  echo(
  echo      Telecharge la version LTS sur https://nodejs.org/  ^(bouton "LTS"^)
  echo      installe-la ^(clique Suivant partout^), puis relance ce fichier.
  echo(
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODEVER=%%v
echo  [OK] Node.js detecte : %NODEVER%

REM --- 2) Installer les dependances si besoin -------------------------------
if not exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo(
  echo  [..] Premiere utilisation : installation des dependances.
  echo       ^(peut prendre 1 a 3 minutes, connexion internet requise^)
  echo(
  call npm install
  if errorlevel 1 (
    echo(
    echo  [X] L'installation des dependances a echoue.
    echo      Verifie ta connexion internet puis relance ce fichier.
    echo(
    pause
    exit /b 1
  )
  echo(
  echo  [OK] Dependances installees.
) else (
  echo  [OK] Dependances deja presentes.
)

REM --- 3) Creer le fichier .env si absent ----------------------------------
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  [OK] Fichier .env cree. ^(Pour l'analyse IA : ouvre .env et colle ta CLAUDE_API_KEY^)
  )
)

REM --- 4) Donnees de demonstration au premier lancement --------------------
if not exist "data\tracker.db" (
  echo  [..] Creation de la base + donnees de demonstration...
  call npm run seed >nul 2>nul
  echo  [OK] Base prete.
)

REM --- 5) Demarrer le serveur dans une fenetre dediee ----------------------
echo(
echo  [..] Demarrage du serveur Ziwa...
start "Serveur Ziwa (laisser ouvert)" cmd /c "node server.js"

REM --- 6) Attendre que le serveur reponde, puis ouvrir le navigateur -------
echo  [..] Ouverture de l'application dans le navigateur...
REM petite attente le temps que le port s'ouvre (le frontend reessaie de toute facon)
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo(
echo  ============================================================
echo    Ziwa est lance !   ->   http://localhost:3000
echo(
echo    - Pour ARRETER : ferme la fenetre "Serveur Ziwa".
echo    - Astuce plein ecran kiosque : touche F11 dans le navigateur.
echo  ============================================================
echo(
echo  Tu peux fermer CETTE fenetre-ci, le serveur continue de tourner.
echo(
pause
exit /b 0
