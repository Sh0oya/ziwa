#!/usr/bin/env bash
# ============================================================================
# slim-pi.sh — transforme le Pi 5 en kiosque minimal "single-app" pour Ziwa.
# Supprime le bureau : boot en console + `cage` (compositeur Wayland mono-app)
# qui lance Chromium plein écran sur l'app. Gros gain RAM/démarrage sur 1 Go.
#
# Idempotent. À lancer depuis le dossier du projet, en utilisateur normal :
#   bash slim-pi.sh
# Réversible : voir la section "POUR REVENIR EN ARRIÈRE" en bas du fichier.
# ============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_USER="$(whoami)"
URL="http://localhost:3000"

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$1"; }

[ "$(id -u)" = "0" ] && { echo "Lance sans sudo : bash slim-pi.sh"; exit 1; }

# ── 1) Paquets : cage (kiosque mono-app) + Chromium + zram ──────────────
say "Installation cage + dépendances"
sudo apt-get update
sudo apt-get install -y cage seatd zram-tools unclutter \
  $(command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1 || echo chromium)
CHROME="$(command -v chromium || command -v chromium-browser)"
sudo systemctl enable --now seatd 2>/dev/null || true
sudo usermod -aG seat,video,render,input "$APP_USER" 2>/dev/null || true
ok "cage + Chromium ($CHROME)"

# ── 2) zram : RAM compressée (crucial sur 1 Go) ─────────────────────────
say "zram (RAM compressée)"
# lzo-rle : algo natif du noyau, fiable sur Debian trixie (lz4 plante avec zram-tools 0.3.7)
echo -e "ALGO=lzo-rle\nPERCENT=60" | sudo tee /etc/default/zramswap >/dev/null
sudo systemctl restart zramswap 2>/dev/null || sudo systemctl restart zramswap.service 2>/dev/null || true
ok "zram actif"

# ── 3) Couper les services inutiles pour un kiosque ─────────────────────
say "Allègement des services"
for s in bluetooth cups cups-browsed ModemManager triggerhappy \
         apt-daily.timer apt-daily-upgrade.timer man-db.timer \
         upower udisks2 accounts-daemon; do
  sudo systemctl disable --now "$s" 2>/dev/null || true
done
# plymouth : écran de démarrage animé (~45s au boot) — inutile pour un kiosque
sudo systemctl disable plymouth-quit-wait.service 2>/dev/null || true
ok "services superflus désactivés (dont plymouth)"

# ── 4) Script de lancement du kiosque (Chromium minimal) ────────────────
say "Script kiosque"
cat > "$APP_DIR/kiosk-cage.sh" <<KIOSK
#!/usr/bin/env bash
# attend que le backend réponde
for i in \$(seq 1 60); do curl -fsS "$URL/api/state" >/dev/null 2>&1 && break; sleep 1; done
unclutter -idle 0.5 >/dev/null 2>&1 &
exec $CHROME \\
  --kiosk --app="$URL" \\
  --ozone-platform=wayland --enable-features=UseOzonePlatform \\
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --disable-features=Translate --check-for-update-interval=31536000 \\
  --overscroll-history-navigation=0 --password-store=basic --no-first-run \\
  --disable-pinch --disable-component-update
KIOSK
chmod +x "$APP_DIR/kiosk-cage.sh"
ok "kiosk-cage.sh"

# ── 5) Service systemd : cage lance le kiosque sur le tty1 ──────────────
say "Service ziwa-kiosk"
sudo tee /etc/systemd/system/ziwa-kiosk.service >/dev/null <<UNIT
[Unit]
Description=Ziwa kiosk (cage + Chromium)
After=diabete-chat.service systemd-user-sessions.service
Wants=diabete-chat.service

[Service]
User=$APP_USER
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=journal
StandardError=journal
# cage = compositeur Wayland mono-fenêtre ; -s = autoriser le VT switch
ExecStart=/usr/bin/cage -s -- $APP_DIR/kiosk-cage.sh
Restart=always
RestartSec=3
# garder l'écran allumé (pas de DPMS)
Environment=WLR_NO_HARDWARE_CURSORS=1

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable ziwa-kiosk
ok "service ziwa-kiosk activé"

# ── 6) Boot en console (plus de bureau) + désactiver l'ancien autostart ──
say "Boot en mode console (sans bureau)"
sudo systemctl set-default multi-user.target
# neutraliser l'ancien autostart labwc s'il existe (évite double lancement)
[ -f "$HOME/.config/labwc/autostart" ] && sed -i '/kiosk.sh/d' "$HOME/.config/labwc/autostart" 2>/dev/null || true
ok "cible de boot = multi-user (console)"

say "Terminé !"
echo "  • Redémarre pour voir le kiosque minimal :  sudo reboot"
echo "  • Logs kiosque :   sudo journalctl -u ziwa-kiosk -f"
echo "  • Logs backend :   sudo journalctl -u diabete-chat -f"
echo
echo "  POUR REVENIR EN ARRIÈRE (rebureau complet) :"
echo "    sudo systemctl disable --now ziwa-kiosk"
echo "    sudo systemctl set-default graphical.target && sudo reboot"
