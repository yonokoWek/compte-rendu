#!/bin/bash
# ==============================================================
#  Compte Rendu - Script d'export
#  Crée une archive .zip propre prête pour le déploiement
#
#  Usage: chmod +x export.sh && ./export.sh
# ==============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="compte-rendu"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_NAME="${PROJECT_NAME}"
EXPORT_DIR="/tmp/${EXPORT_NAME}"

echo ""
echo -e "${CYAN}${BOLD}📦 Création de l'archive de déploiement...${NC}"

# Nettoyer
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# Copier le projet
cp -r "$SCRIPT_DIR"/* "$EXPORT_DIR/"
cp "$SCRIPT_DIR"/.env.example "$EXPORT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/.dockerignore "$EXPORT_DIR/" 2>/dev/null || true

cd "$EXPORT_DIR"

# Supprimer les fichiers inutiles
rm -rf \
    node_modules .next .git \
    skills tool-results upload download \
    examples tests mini-services \
    db/*.db db/*.db-journal \
    dev.log server.log keep_alive.sh generate.py worklog.md \
    screenshot*.png test.png verify*.png final-*.png \
    *.zip auth-state.json

# Créer le zip
ZIP_PATH="${SCRIPT_DIR}/${PROJECT_NAME}.zip"
rm -f "$ZIP_PATH"
zip -r -q "$ZIP_PATH" .

SIZE=$(du -h "$ZIP_PATH" | cut -f1)

echo ""
echo -e "${GREEN}✅ Archive créée : ${BLUE}${ZIP_PATH}${NC}"
echo -e "   Taille : ${BOLD}${SIZE}${NC}"
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}📋 GUIDE DE DÉPLOIEMENT EN 3 ÉTAPES :${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}ÉTAPE 1 — Créer un serveur gratuit :${NC}"
echo ""
echo "  🌐 Option recommandée : Oracle Cloud Free Tier"
echo "     → https://cloud.oracle.com (gratuit à vie)"
echo "     → Créer un compte → Compute → Instances"
echo "     → Choisir : Ubuntu 24.04, ARM (4 cores, 24 Go RAM, GRATUIT)"
echo "     → Notez l'adresse IP publique"
echo "     → En SSH : Ouvrir le port 22, puis aussi 80 et 443"
echo ""
echo "  Alternatives gratuites :"
echo "     • Google Cloud Free Tier (e2-micro)"
echo "     • AWS Free Tier (12 mois)"
echo ""
echo -e "${YELLOW}ÉTAPE 2 — Envoyer et installer :${NC}"
echo ""
echo "  Connectez-vous en SSH à votre serveur :"
echo -e "    ${BLUE}ssh ubuntu@VOTRE-IP-PUBLIQUE${NC}"
echo ""
echo "  Envoyez le fichier zip (depuis votre PC) :"
echo -e "    ${BLUE}scp ${PROJECT_NAME}.zip ubuntu@VOTRE-IP-PUBLIQUE:/home/ubuntu/${NC}"
echo ""
echo "  Sur le serveur, tapez ces commandes :"
echo -e "    ${BLUE}unzip ${PROJECT_NAME}.zip -d compte-rendu${NC}"
echo -e "    ${BLUE}cd compte-rendu${NC}"
echo -e "    ${BLUE}chmod +x install.sh${NC}"
echo -e "    ${BLUE}sudo ./install.sh${NC}           ← Installation automatique !"
echo ""
echo "  🌐 Avec un domaine (HTTPS auto) :"
echo -e "    ${BLUE}sudo ./install.sh votre-domaine.com${NC}"
echo ""
echo -e "${YELLOW}ÉTAPE 3 — Profiter !${NC}"
echo ""
echo "  📱 Ouvrez l'adresse dans Chrome sur votre téléphone"
echo "     → Menu ⋮ → « Installer l'application »"
echo ""
echo "  🔒 HTTPS est automatique si vous avez un domaine (via Caddy)"
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
