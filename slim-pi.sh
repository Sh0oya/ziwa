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

# ── 1) Paquets : cage (kiosque mono-app) + cog (navigateur WebKit léger) ─
# cog est choisi plutôt que Chromium : ~150 Mo au lieu de ~350 (crucial sur 1 Go),
# pensé pour le kiosque, sans les soucis de flags/keyring de Chromium sous cage.
say "Installation cage + cog"
sudo apt-get update
sudo apt-get install -y cage seatd zram-tools cog
COG="$(command -v cog)"
sudo systemctl enable --now seatd 2>/dev/null || true
sudo usermod -aG seat,video,render,input "$APP_USER" 2>/dev/null || true
ok "cage + cog ($COG)"

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

# ── 4) Script de lancement du kiosque (cog) ─────────────────────────────
say "Script kiosque"
cat > "$APP_DIR/kiosk-cage.sh" <<KIOSK
#!/usr/bin/env bash
# attend que le backend réponde avant de lancer le navigateur
for i in \$(seq 1 60); do curl -fsS "$URL/api/state" >/dev/null 2>&1 && break; sleep 1; done
# cog : navigateur kiosque WebKit. -platform=wl + plein écran géré par cage.
exec $COG --platform=wl "$URL"
KIOSK
chmod +x "$APP_DIR/kiosk-cage.sh"
ok "kiosk-cage.sh (cog)"

# ── 4b) Curseur invisible (écran tactile) ──────────────────────────────────
# cage dessine un curseur au centre même sans souris, et ignore les thèmes vides.
# La seule méthode fiable sur Pi (cf. forum RaspberryPi) : neutraliser le fichier
# de curseur "left_ptr" de TOUS les thèmes système → cage ne le trouve plus.
# (Le CSS `cursor:none` de l'app gère le curseur DANS la page ; ceci gère celui
#  du compositeur. Les deux sont complémentaires.)
say "Curseur invisible (neutralisation left_ptr)"
CUR_N=0
for f in /usr/share/icons/*/cursors/left_ptr; do
  if [ -e "$f" ] && [ ! -e "$f.bak" ]; then sudo mv "$f" "$f.bak" && CUR_N=$((CUR_N+1)); fi
done
ok "curseurs système neutralisés ($CUR_N) — restauration : *.bak"

# ── 5) Auto-login sur tty1 + lancement de cage depuis le profil ─────────
# Méthode robuste sur Pi : getty connecte "ziwa" automatiquement sur tty1, ce
# qui crée une vraie session/seat ; le profil lance alors cage. Pas de PAMName
# fragile, pas de souci de "seat" comme avec un service systemd isolé.
say "Auto-login tty1 + lancement cage"

# retirer un éventuel ancien service ziwa-kiosk (méthode précédente)
sudo systemctl disable --now ziwa-kiosk 2>/dev/null || true
sudo rm -f /etc/systemd/system/ziwa-kiosk.service

# auto-login getty sur tty1
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<UNIT
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $APP_USER --noclear %I \$TERM
UNIT

# lancement de cage au login sur tty1 uniquement (et pas en SSH !)
PROFILE="$HOME/.bash_profile"
# nettoyer une éventuelle ancienne version du bloc
sed -i '/ZIWA_KIOSK/,+4d' "$PROFILE" 2>/dev/null || true
cat >> "$PROFILE" <<PROF

# ZIWA_KIOSK — lancer le kiosque uniquement sur la console physique (tty1)
if [ "\$(tty)" = "/dev/tty1" ] && [ -z "\${WAYLAND_DISPLAY:-}" ]; then
  exec cage -s -- "$APP_DIR/kiosk-cage.sh"
fi
PROF
sudo systemctl daemon-reload
ok "auto-login + cage configurés (curseur masqué, console tty1)"

# ── 6) Boot en console (plus de bureau) + désactiver l'ancien autostart ──
say "Boot en mode console (sans bureau)"
sudo systemctl set-default multi-user.target
# neutraliser l'ancien autostart labwc s'il existe (évite double lancement)
[ -f "$HOME/.config/labwc/autostart" ] && sed -i '/kiosk.sh/d' "$HOME/.config/labwc/autostart" 2>/dev/null || true
ok "cible de boot = multi-user (console)"

say "Terminé !"
echo "  • Redémarre pour voir le kiosque minimal :  sudo reboot"
echo "  • Logs backend :   sudo journalctl -u diabete-chat -f"
echo "  • Relancer le kiosque sans reboot : sudo systemctl restart getty@tty1"
echo
echo "  POUR REVENIR EN ARRIÈRE (rebureau complet) :"
echo "    sudo rm /etc/systemd/system/getty@tty1.service.d/autologin.conf"
echo "    sed -i '/ZIWA_KIOSK/,+3d' ~/.bash_profile"
echo "    for f in /usr/share/icons/*/cursors/left_ptr.bak; do sudo mv \"\$f\" \"\${f%.bak}\"; done   # restaurer curseur"
echo "    sudo systemctl set-default graphical.target && sudo reboot"
