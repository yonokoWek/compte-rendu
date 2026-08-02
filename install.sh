#!/bin/bash
# ==============================================
# Compte Rendu - Script d'installation Linux
# Pour VPS (Ubuntu/Debian) sans Docker
# 
# Usage: chmod +x install.sh && ./install.sh
# ==============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/compte-rendu"
SERVICE_NAME="compte-rendu"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Compte Rendu - Installation              ║"
echo "║     Rapport d'Activités Spirituelles         ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Check root ----
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ce script doit être exécuté en tant que root (sudo).${NC}"
    echo "Utilisez: sudo ./install.sh"
    exit 1
fi

# ---- Detect OS ----
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}OS non reconnu. Utilisez Ubuntu 20.04+ ou Debian 11+.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ OS détecté: $OS $VERSION${NC}"

# ---- Step 1: Update system ----
echo -e "${YELLOW}[1/7] Mise à jour du système...${NC}"
apt-get update -qq
apt-get upgrade -y -qq > /dev/null 2>&1

# ---- Step 2: Install system dependencies ----
echo -e "${YELLOW}[2/7] Installation des dépendances système...${NC}"
apt-get install -y -qq \
    curl \
    unzip \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    fonts-liberation \
    ca-certificates \
    > /dev/null 2>&1

echo -e "${GREEN}✓ Chromium et polices installés${NC}"

# ---- Step 3: Install Bun ----
echo -e "${YELLOW}[3/7] Installation de Bun...${NC}"
if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓ Bun déjà installé: $(bun --version)${NC}"
else
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    # Make bun available system-wide
    ln -sf $BUN_INSTALL/bin/bun /usr/local/bin/bun
    echo -e "${GREEN}✓ Bun installé: $(bun --version)${NC}"
fi

# ---- Step 4: Copy project files ----
echo -e "${YELLOW}[4/7] Installation de l'application...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}  $APP_DIR existe déjà, mise à jour...${NC}"
    rm -rf "$APP_DIR"
fi

cp -r "$SCRIPT_DIR" "$APP_DIR"
rm -rf "$APP_DIR"/.git "$APP_DIR"/tool-results "$APP_DIR"/upload "$APP_DIR"/screenshot*.png \
    "$APP_DIR"/test.png "$APP_DIR"/verify*.png "$APP_DIR"/final-*.png "$APP_DIR"/dev.log \
    "$APP_DIR"/server.log "$APP_DIR"/keep_alive.sh "$APP_DIR"/generate.py "$APP_DIR"/tests \
    "$APP_DIR"/examples "$APP_DIR"/download

# Remove database files (will be created fresh)
rm -f "$APP_DIR"/db/*.db "$APP_DIR"/db/*.db-journal"

echo -e "${GREEN}✓ Fichiers copiés dans $APP_DIR${NC}"

# ---- Step 5: Install Node dependencies ----
echo -e "${YELLOW}[5/7] Installation des dépendances Node.js...${NC}"
cd "$APP_DIR"
bun install --production 2>&1 | tail -1
echo -e "${GREEN}✓ Dépendances installées${NC}"

# ---- Step 6: Setup database ----
echo -e "${YELLOW}[6/7] Configuration de la base de données...${NC}"
mkdir -p "$APP_DIR/db"

# Create .env if not exists
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    # Update DATABASE_URL for the install location
    sed -i "s|file:./db/custom.db|file:$APP_DIR/db/compte-rendu.db|g" "$APP_DIR/.env"
fi

# Push schema to create database
bunx prisma db push --accept-data-loss 2>&1 | tail -1
echo -e "${GREEN}✓ Base de données créée${NC}"

# Build the application
# Skip TypeScript errors (same as dev config)
bun run build 2>&1 | tail -5

echo -e "${GREEN}✓ Application compilée${NC}"

# ---- Step 7: Create systemd service ----
echo -e "${YELLOW}[7/7] Configuration du service systemd...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
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
Environment=PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
Environment=PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
Environment=PORT=3000
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=5

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR/db $APP_DIR/upload /tmp

[Install]
WantedBy=multi-user.target
EOF

# Ensure www-data owns the app files
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
mkdir -p "$APP_DIR/db" "$APP_DIR/upload"
chown -R www-data:www-data "$APP_DIR/db" "$APP_DIR/upload"

# Reload and enable service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

sleep 3

# Check status
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✓ Service démarré avec succès${NC}"
else
    echo -e "${RED}✗ Le service n'a pas pu démarrer. Vérifiez avec: journalctl -u ${SERVICE_NAME}${NC}"
    exit 1
fi

# ---- Done ----
echo ""
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     ✅ Installation terminée !               ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${GREEN}Application disponible sur: ${BLUE}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo ""
echo "Commandes utiles:"
echo "  Voir le statut:  sudo systemctl status $SERVICE_NAME"
echo "  Voir les logs:   sudo journalctl -u $SERVICE_NAME -f"
echo "  Redémarrer:      sudo systemctl restart $SERVICE_NAME"
echo "  Arrêter:         sudo systemctl stop $SERVICE_NAME"
echo "  Mettre à jour:   cd $APP_DIR && git pull && bun install && bun run build && sudo systemctl restart $SERVICE_NAME"
echo ""
echo -e "${YELLOW}Astuce: Pour un accès depuis internet, configurez un nom de domaine"
echo "avec Caddy ou Nginx comme reverse proxy sur le port 80/443.${NC}"
echo ""
