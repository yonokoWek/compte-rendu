#!/bin/bash
# ==============================================
# Compte Rendu - Script d'export
# Crée une archive .zip propre pour distribution
#
# Usage: chmod +x export.sh && ./export.sh
# ==============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="compte-rendu"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_NAME="${PROJECT_NAME}-${TIMESTAMP}"
EXPORT_DIR="/tmp/${EXPORT_NAME}"

echo -e "${BLUE}📦 Création de l'archive d'export...${NC}"

# Clean temp dir
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# Copy project files
cp -r "$SCRIPT_DIR"/* "$EXPORT_DIR/"
cp "$SCRIPT_DIR"/.env.example "$EXPORT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/.dockerignore "$EXPORT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/Dockerfile "$EXPORT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/docker-compose.yml "$EXPORT_DIR/" 2>/dev/null || true

# Remove unnecessary files from export
cd "$EXPORT_DIR"
rm -rf \
    node_modules \
    .next \
    .git \
    skills \
    tool-results \
    upload \
    download \
    examples \
    tests \
    mini-services \
    db/*.db \
    db/*.db-journal \
    dev.log \
    server.log \
    keep_alive.sh \
    generate.py \
    worklog.md \
    screenshot*.png \
    test.png \
    verify*.png \
    final-*.png \
    test.txt

# Remove screenshots, temp images, and old zip exports
rm -f screenshot-*.png verify-*.png final-*.png test.png *.zip 2>/dev/null || true

# Create zip
ZIP_PATH="${SCRIPT_DIR}/${EXPORT_NAME}.zip"
zip -r -q "$ZIP_PATH" .

echo -e "${GREEN}✅ Archive créée: ${BLUE}${ZIP_PATH}${NC}"
echo ""
echo -e "${YELLOW}Taille: $(du -h "$ZIP_PATH" | cut -f1)${NC}"
echo ""
echo "Comment installer:"
echo ""
echo -e "  ${BLUE}Option 1 - Docker (recommandé):${NC}"
echo "    1. Envoyez ${EXPORT_NAME}.zip sur votre serveur"
echo "    2. unzip ${EXPORT_NAME}.zip -d compte-rendu"
echo "    3. cd compte-rendu"
echo "    4. docker compose up -d"
echo ""
echo -e "  ${BLUE}Option 2 - Installation directe:${NC}"
echo "    1. Envoyez ${EXPORT_NAME}.zip sur votre serveur (Ubuntu/Debian)"
echo "    2. unzip ${EXPORT_NAME}.zip -d compte-rendu"
echo "    3. cd compte-rendu"
echo "    4. chmod +x install.sh"
echo "    5. sudo ./install.sh"
echo ""