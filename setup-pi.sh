#!/usr/bin/env bash
# ============================================================================
# setup-pi.sh — installation/déploiement de Ziwa sur Raspberry Pi 5 (Pi OS).
# Idempotent : peut être relancé sans danger (met à jour ce qui existe déjà).
#
# Usage :
#   bash setup-pi.sh                 # serveur + service systemd + kiosque
#   bash setup-pi.sh --no-kiosk      # serveur seulement (pas de Chromium auto)
#
# Doit être lancé depuis le dossier du projet (là où se trouve server.js),
# par l'utilisateur normal (ex. "ziwa"), PAS en root/sudo.
# ============================================================================
set -euo pipefail

KIOSK=1
[ "${1:-}" = "--no-kiosk" ] && KIOSK=0

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_USER="$(whoami)"
URL="http://localhost:3000"

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$1"; }

if [ "$(id -u)" = "0" ]; then
  echo "Ne lance PAS ce script en root/sudo. Fais : bash setup-pi.sh"; exit 1
fi
if [ ! -f "$APP_DIR/server.js" ]; then
  echo "server.js introuvable dans $APP_DIR — lance le script depuis le dossier du projet."; exit 1
fi

# ── 1) Node.js LTS ──────────────────────────────────────────────────────
say "Node.js"
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js absent — installation de la LTS…"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
ok "Node.js $(node --version) / npm $(npm --version)"

# ── 2) Dépendances de l'app ─────────────────────────────────────────────
say "Dépendances npm"
cd "$APP_DIR"
if npm ci --omit=dev 2>/dev/null; then ok "npm ci"; else
  warn "npm ci impossible (pas de lockfile ?) → npm install"
  npm install --omit=dev
fi
# Filet de sécurité si le binaire natif ARM64 n'est pas pré-compilé :
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  warn "better-sqlite3 doit être recompilé — installation des outils de build…"
  sudo apt-get install -y python3 build-essential
  npm rebuild better-sqlite3
fi
node -e "require('better-sqlite3')" && ok "better-sqlite3 OK"

# ── 3) .env + base de démonstration ─────────────────────────────────────
say "Configuration"
if [ ! -f .env ]; then cp .env.example .env; ok ".env créé (pense à y mettre CLAUDE_API_KEY)"; else ok ".env déjà présent"; fi
if [ ! -f data/tracker.db ]; then npm run seed >/dev/null 2>&1 || true; ok "base + données de démo"; else ok "base déjà présente"; fi

# ── 4) Service systemd (backend au boot, redémarrage auto) ──────────────
say "Service systemd (backend)"
NODE_BIN="$(command -v node)"
sudo tee /etc/systemd/system/diabete-chat.service >/dev/null <<UNIT
[Unit]
Description=Ziwa — suivi diabète félin (backend)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=3
User=$APP_USER
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now diabete-chat
sleep 2
if curl -fsS "$URL/api/state" >/dev/null 2>&1; then ok "backend en ligne sur $URL"; else
  warn "backend pas encore prêt — voir: sudo journalctl -u diabete-chat -e"; fi

# ── 5) Mode kiosque (auto-détection du compositeur) ─────────────────────
if [ "$KIOSK" = "1" ]; then
  say "Mode kiosque (Chromium plein écran au démarrage)"

  CHROME="$(command -v chromium-browser || command -v chromium || true)"
  if [ -z "$CHROME" ]; then
    warn "Chromium absent — installation…"
    sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
    CHROME="$(command -v chromium-browser || command -v chromium)"
  fi
  sudo apt-get install -y unclutter >/dev/null 2>&1 || true
  ok "Chromium : $CHROME"

  # Script de lancement kiosque commun (désactive veille écran + popups restore)
  cat > "$APP_DIR/kiosk.sh" <<KIOSK
#!/usr/bin/env bash
# Lancement de Chromium en kiosque sur l'app Ziwa. Attend que le backend réponde.
for i in \$(seq 1 30); do curl -fsS "$URL/api/state" >/dev/null 2>&1 && break; sleep 1; done
# garder l'écran allumé (Wayland puis X11, selon ce qui est dispo)
command -v wlr-randr >/dev/null 2>&1 && wlr-randr --output HDMI-A-1 --on >/dev/null 2>&1 || true
command -v xset >/dev/null 2>&1 && { xset s off; xset -dpms; xset s noblank; } 2>/dev/null || true
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0.5 -root &
exec "$CHROME" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --disable-features=Translate --check-for-update-interval=31536000 \\
  --overscroll-history-navigation=0 --password-store=basic --no-first-run \\
  --app="$URL"
KIOSK
  chmod +x "$APP_DIR/kiosk.sh"
  ok "kiosk.sh créé"

  # Auto-détection du compositeur et écriture de l'autostart adéquat
  CODENAME="$(. /etc/os-release; echo "${VERSION_CODENAME:-}")"
  CFG="$HOME/.config"
  if [ -x /usr/bin/labwc ] || [ -d "$CFG/labwc" ]; then
    mkdir -p "$CFG/labwc"
    grep -q kiosk.sh "$CFG/labwc/autostart" 2>/dev/null || echo "$APP_DIR/kiosk.sh &" >> "$CFG/labwc/autostart"
    chmod +x "$CFG/labwc/autostart" 2>/dev/null || true
    ok "autostart labwc → $CFG/labwc/autostart"
  elif [ -f "$CFG/wayfire.ini" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    touch "$CFG/wayfire.ini"
    if ! grep -q '^\[autostart\]' "$CFG/wayfire.ini"; then printf '\n[autostart]\n' >> "$CFG/wayfire.ini"; fi
    grep -q 'ziwa_kiosk' "$CFG/wayfire.ini" || sed -i "/^\[autostart\]/a ziwa_kiosk = $APP_DIR/kiosk.sh" "$CFG/wayfire.ini"
    ok "autostart wayfire → $CFG/wayfire.ini"
  else
    # X11 (LXDE) — fallback
    mkdir -p "$CFG/autostart"
    cat > "$CFG/autostart/ziwa-kiosk.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Ziwa Kiosk
Exec=$APP_DIR/kiosk.sh
X-GNOME-Autostart-enabled=true
DESK
    ok "autostart X11 → $CFG/autostart/ziwa-kiosk.desktop"
  fi

  warn "Active l'auto-login bureau si ce n'est pas fait :"
  echo "     sudo raspi-config  →  System Options → Boot/Auto Login → Desktop Autologin"
fi

say "Terminé !"
echo "  • App : $URL  (ou http://$(hostname -I | awk '{print $1}'):3000 depuis un autre appareil)"
echo "  • Logs backend : sudo journalctl -u diabete-chat -f"
echo "  • Redémarrer le backend : sudo systemctl restart diabete-chat"
[ "$KIOSK" = "1" ] && echo "  • Pour voir le kiosque : sudo reboot"
