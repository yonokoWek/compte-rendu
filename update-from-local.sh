#!/bin/bash
# ==============================================================
#  Compte Rendu - Script de mise à jour
#
#  Mise à jour simple :
#    cd /opt/compte-rendu && sudo ./update-from-local.sh
#
#  Avec changement de domaine :
#    cd /opt/compte-rendu && sudo ./update-from-local.sh nouveau-domaine.com
#
#  Mise à jour depuis un nouveau zip :
#    unzip nouveau-cr.zip -d /tmp/cr-new
#    cd /tmp/cr-new && sudo ./deploy-to-server.sh [domaine]
# ==============================================================

APP_DIR="/opt/compte-rendu"
SERVICE_NAME="compte-rendu"
DOMAIN="${1:-}"

if [ "$EUID" -ne 0 ]; then
    echo "❌ Exécutez avec : sudo ./update-from-local.sh [domaine]"
    exit 1
fi

echo "🔄 Mise à jour de Compte Rendu..."

# Arrêter le service
systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# Mettre à jour les fichiers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR"/* "$APP_DIR/" 2>/dev/null
cp "$SCRIPT_DIR"/.env.example "$APP_DIR/" 2>/dev/null || true

cd "$APP_DIR"

# Nettoyer
rm -rf node_modules .next
rm -f db/*.db-journal

# Installer + compiler
bun install --production 2>&1 | tail -1
bunx prisma generate 2>&1 | tail -1
bunx prisma db push --accept-data-loss 2>&1 | tail -1

export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
bun run build 2>&1 | tail -3

# Permissions
chown -R www-data:www-data "$APP_DIR"

# Redémarrer
systemctl start "$SERVICE_NAME"
sleep 2

# Mettre à jour Caddy si un domaine est fourni
if [ -n "$DOMAIN" ]; then
    cat > /etc/caddy/Caddyfile << EOF
$DOMAIN {
    reverse_proxy localhost:3000
    header X-Content-Type-Options "nosniff"
    header X-Frame-Options "SAMEORIGIN"
    header -Server
    log {
        output file /var/log/caddy/compte-rendu.log
        format console
    }
}
EOF
    systemctl reload caddy 2>/dev/null || systemctl restart caddy
    echo "🌐 HTTPS configuré pour : https://$DOMAIN"
fi

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Mise à jour terminée !"
else
    echo "❌ Erreur. Vérifiez : sudo journalctl -u $SERVICE_NAME --no-pager -n 20"
    exit 1
fi
