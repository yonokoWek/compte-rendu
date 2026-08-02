#!/bin/bash
# ==============================================
# Compte Rendu - Script de mise à jour
# Pour mettre à jour l'application après un changement de code
#
# Usage: chmod +x update.sh && sudo ./update.sh
# ==============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVICE_NAME="compte-rendu"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Exécution en tant que root (sudo) recommandée.${NC}"
fi

echo -e "${YELLOW}🔄 Mise à jour de Compte Rendu...${NC}"

# 1. Install dependencies
echo -e "${YELLOW}[1/4] Installation des dépendances...${NC}"
cd "$APP_DIR"
bun install

echo -e "${GREEN}✓ Dépendances mises à jour${NC}"

# 2. Generate Prisma client
echo -e "${YELLOW}[2/4] Mise à jour du client Prisma...${NC}"
bunx prisma generate
bunx prisma db push --accept-data-loss

echo -e "${GREEN}✓ Base de données mise à jour${NC}"

# 3. Build
echo -e "${YELLOW}[3/4] Compilation...${NC}"
bun run build

echo -e "${GREEN}✓ Application compilée${NC}"

# 4. Restart service
echo -e "${YELLOW}[4/4] Redémarrage du service...${NC}"
if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
    systemctl restart ${SERVICE_NAME}
    echo -e "${GREEN}✓ Service redémarré${NC}"
elif docker compose ps -q 2>/dev/null | grep -q .; then
    docker compose up -d --build
    echo -e "${GREEN}✓ Conteneur Docker reconstruit${NC}"
else
    echo -e "${YELLOW}Aucun service trouvé. Utilisez 'bun run start' pour démarrer.${NC}"
fi

echo ""
echo -e "${GREEN}✅ Mise à jour terminée !${NC}"
