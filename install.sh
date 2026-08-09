#!/bin/bash
# ==============================================================
#  Compte Rendu - Script d'installation automatique (1 commande)
#  Pour VPS Ubuntu/Debian — installe tout : app + Caddy + HTTPS
#
#  Utilisation sur votre serveur :
#    curl -sL https://votre-lien.zip -o cr.zip && unzip cr.zip -d compte-rendu && cd compte-rendu && chmod +x install.sh && sudo ./install.sh
#
#  Ou avec un domaine :
#    sudo ./install.sh votre-domaine.com
# ==============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_DIR="/opt/compte-rendu"
SERVICE_NAME="compte-rendu"
DOMAIN="${1:-}"

echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║      📖 Compte Rendu — Installation             ║"
echo "  ║      Rapport d'Activités Spirituelles           ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Vérification root ----
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en tant que root (sudo).${NC}"
    echo "   Utilisez : sudo ./install.sh${NC}"
    echo "   Ou : sudo ./install.sh votre-domaine.com"
    exit 1
fi

# ---- Détection OS ----
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}❌ OS non reconnu. Utilisez Ubuntu 20.04+ ou Debian 11+.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ OS détecté : $OS $VERSION${NC}"

# ---- Étape 1 : Mise à jour système ----
echo -e "${YELLOW}[1/8] Mise à jour du système...${NC}"
apt-get update -qq
apt-get upgrade -y -qq > /dev/null 2>&1
echo -e "${GREEN}✅ Système à jour${NC}"

# ---- Étape 2 : Dépendances système ----
echo -e "${YELLOW}[2/8] Installation des dépendances système...${NC}"
apt-get install -y -qq \
    curl unzip wget software-properties-common \
    apt-transport-https ca-certificates gnupg \
    fonts-noto fonts-noto-cjk fonts-liberation \
    > /dev/null 2>&1
echo -e "${GREEN}✅ Dépendances système installées${NC}"

# ---- Étape 3 : Installer Caddy (reverse proxy + HTTPS auto) ----
echo -e "${YELLOW}[3/8] Installation de Caddy (HTTPS automatique)...${NC}"
if command -v caddy &> /dev/null; then
    echo -e "${GREEN}✅ Caddy déjà installé : $(caddy version | head -1)${NC}"
else
    # Ajouter le dépôt Caddy officiel
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https -qq > /dev/null 2>&1
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -qq
    apt-get install -y caddy -qq > /dev/null 2>&1
    echo -e "${GREEN}✅ Caddy installé : $(caddy version | head -1)${NC}"
fi

# ---- Étape 4 : Installer Bun ----
echo -e "${YELLOW}[4/8] Installation de Bun...${NC}"
if command -v bun &> /dev/null; then
    echo -e "${GREEN}✅ Bun déjà installé : $(bun --version)${NC}"
else
    curl -fsSL https://bun.sh/install | bash > /dev/null 2>&1
    BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
    echo -e "${GREEN}✅ Bun installé : $(bun --version)${NC}"
fi

# ---- Étape 5 : Copier les fichiers ----
echo -e "${YELLOW}[5/8] Installation de l'application...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}  📁 $APP_DIR existe, mise à jour...${NC}"
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    rm -rf "$APP_DIR"
fi

cp -r "$SCRIPT_DIR" "$APP_DIR"

# Nettoyer les fichiers inutiles
cd "$APP_DIR"
rm -rf \
    .git tool-results upload download examples tests mini-services \
    screenshot*.png test.png verify*.png final-*.png \
    dev.log server.log keep_alive.sh generate.py worklog.md \
    *.zip auth-state.json verify-pwa.png

# Supprimer la base de données locale (sera recréée)
rm -f db/*.db db/*.db-journal
mkdir -p db upload public/upload

echo -e "${GREEN}✅ Fichiers copiés dans $APP_DIR${NC}"

# ---- Étape 6 : Installer dépendances et compiler ----
echo -e "${YELLOW}[6/8] Installation des dépendances et compilation...${NC}"
cd "$APP_DIR"

# Créer le .env
cp .env.example .env
sed -i "s|file:./db/compte-rendu.db|file:$APP_DIR/db/compte-rendu.db|g" .env

# Installer les dépendances
bun install --production 2>&1 | tail -1

# Générer Prisma client
bunx prisma generate 2>&1 | tail -1

# Créer la base de données
bunx prisma db push --accept-data-loss 2>&1 | tail -1
echo -e "${GREEN}✅ Base de données créée${NC}"

# Compiler l'application
bun run build 2>&1 | tail -3
echo -e "${GREEN}✅ Application compilée${NC}"

# ---- Étape 7 : Service systemd ----
echo -e "${YELLOW}[7/8] Configuration du service...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << SYSTEMD_EOF
[Unit]
Description=Compte Rendu - Application Spirituelle
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:$APP_DIR/db/compte-rendu.db
Environment=PORT=3000
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Sécurité
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR/db $APP_DIR/upload $APP_DIR/public/upload /tmp

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

# Permissions
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chown -R www-data:www-data "$APP_DIR/db" "$APP_DIR/upload" "$APP_DIR/public/upload"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service démarré avec succès${NC}"
else
    echo -e "${RED}❌ Le service n'a pas pu démarrer.${NC}"
    echo "   Vérifiez : sudo journalctl -u $SERVICE_NAME --no-pager -n 20"
    exit 1
fi

# ---- Étape 8 : Configuration Caddy + HTTPS ----
echo -e "${YELLOW}[8/8] Configuration du reverse proxy...${NC}"

SERVER_IP=$(hostname -I | awk '{print $1}')

if [ -n "$DOMAIN" ]; then
    # ---- Avec domaine : HTTPS automatique ----
    cat > /etc/caddy/Caddyfile << CADDY_EOF
$DOMAIN {
    reverse_proxy localhost:3000

    # Sécurité headers
    header X-Content-Type-Options "nosniff"
    header X-Frame-Options "SAMEORIGIN"
    header -Server

    # Logging
    log {
        output file /var/log/caddy/compte-rendu.log
        format console
    }
}
CADDY_EOF

    systemctl reload caddy 2>/dev/null || systemctl restart caddy
    echo -e "${GREEN}✅ Caddy configuré pour $DOMAIN (HTTPS auto)${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}  🌐 Votre application sera disponible sur :${NC}"
    echo -e "     ${GREEN}https://$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}  ⚠️  Assurez-vous que votre DNS pointe vers $SERVER_IP${NC}"
    echo "     Type A : $DOMAIN → $SERVER_IP"
    echo "     (Laissez 5-30 min pour la propagation DNS)"
else
    # ---- Sans domaine : HTTP simple ----
    cat > /etc/caddy/Caddyfile << CADDY_EOF
:80 {
    reverse_proxy localhost:3000

    header X-Content-Type-Options "nosniff"
    header -Server

    log {
        output file /var/log/caddy/compte-rendu.log
        format console
    }
}
CADDY_EOF

    systemctl reload caddy 2>/dev/null || systemctl restart caddy
    echo -e "${GREEN}✅ Caddy configuré en mode HTTP${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}  🌐 Votre application est disponible sur :${NC}"
    echo -e "     ${GREEN}http://$SERVER_IP${NC}"
    echo ""
    echo -e "${YELLOW}  💡 Pour ajouter un domaine + HTTPS gratuit plus tard :${NC}"
    echo "     1. Achetez un domaine (ex: Namecheap, OVH — ~5$/an)"
    echo "     2. Pointez le DNS (Type A) vers $SERVER_IP"
    echo "     3. Relancez : sudo ./update.sh votre-domaine.com"
fi

# ---- Résumé final ----
echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║      ✅ Installation terminée avec succès !     ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${BOLD}📦 Commandes utiles :${NC}"
echo ""
echo "  Voir le statut  :  sudo systemctl status $SERVICE_NAME"
echo "  Voir les logs    :  sudo journalctl -u $SERVICE_NAME -f"
echo "  Redémarrer       :  sudo systemctl restart $SERVICE_NAME"
echo "  Arrêter          :  sudo systemctl stop $SERVICE_NAME"
echo "  Logs Caddy       :  sudo journalctl -u caddy -f"
echo ""
echo -e "${BOLD}📱 Sur votre téléphone :${NC}"
echo "  Ouvrez l'adresse dans Chrome → Menu → « Installer l'application »"
echo ""
echo -e "${BOLD}🔒 HTTPS gratuit :${NC}"
echo "  Caddy génère automatiquement un certificat SSL Let's Encrypt."
echo "  Il suffit d'ajouter un domaine pointant vers ce serveur."
echo ""
