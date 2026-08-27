#!/bin/bash
# ==========================================
# Compte Rendu - Déploiement Supabase
# ==========================================
# Ce script configure la base de données Supabase
# et prépare l'application pour le déploiement.
# ==========================================

set -e

echo "============================================"
echo "  Compte Rendu - Configuration Supabase"
echo "============================================"
echo ""

# Demander l'URL de connexion Supabase
if [ -z "$1" ]; then
  echo "Entrez votre URL de connexion Supabase :"
  echo "(Format: postgresql://postgres:[MOT_DE_PASSE]@db.[PROJECT-REF].supabase.co:5432/postgres)"
  read -r SUPABASE_URL
else
  SUPABASE_URL="$1"
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ URL requise. Usage: ./deploy-supabase.sh 'votre_url_supabase'"
  echo ""
  echo "Où trouver l'URL :"
  echo "  1. Allez sur https://supabase.com/dashboard"
  echo "  2. Sélectionnez votre projet"
  echo "  3. Settings → Database → Connection string → URI"
  echo ""
  exit 1
fi

# Encoder les caractères spéciaux dans le mot de passe
encode_url() {
  local url="$1"
  # Encoder les caractères spéciaux qui posent problème dans les URLs
  url=$(echo "$url" | sed 's/#/%23/g')
  url=$(echo "$url" | sed 's/@/%40/g')
  # Mais il faut garder le @ qui sépare les credentials de l'hôte
  # Le dernier @ doit rester
  local last_at=$(echo "$url" | grep -o '%40' | wc -l)
  local count=0
  local result=""
  local i=0
  while [ $i -lt ${#url} ]; do
    local char="${url:$i:1}"
    if [[ "$char" == "%" && "${url:$i:3}" == "%40" ]]; then
      count=$((count + 1))
      if [ $count -eq $last_at ]; then
        result+="@"
        i=$((i + 3))
        continue
      fi
      result+="%40"
      i=$((i + 3))
      continue
    fi
    result+="$char"
    i=$((i + 1))
  done
  echo "$result"
}

ENCODED_URL=$(encode_url "$SUPABASE_URL")
echo "✅ URL traitée"

# 1. Mettre à jour le schéma Prisma pour PostgreSQL
echo ""
echo "📝 Mise à jour du schéma Prisma pour PostgreSQL..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
echo "   ✓ Provider changé en PostgreSQL"

# 2. Mettre à jour le .env
echo ""
echo "📝 Configuration de DATABASE_URL..."
echo "DATABASE_URL=\"$ENCODED_URL\"" > .env
echo "   ✓ .env mis à jour"

# 3. Installer les dépendances si nécessaire
echo ""
echo "📦 Vérification des dépendances..."
if ! command -v bun &> /dev/null; then
  echo "   Installation de Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

bun install
bun add pg
echo "   ✓ Dépendances installées"

# 4. Générer le client Prisma
echo ""
echo "🔧 Génération du client Prisma..."
bunx prisma generate
echo "   ✓ Client Prisma généré"

# 5. Pousser le schéma vers Supabase
echo ""
echo "🚀 Envoi du schéma vers Supabase PostgreSQL..."
echo "   (Cela crée toutes les tables automatiquement)"
bunx prisma db push --accept-data-loss
echo "   ✓ Tables créées sur Supabase"

echo ""
echo "============================================"
echo "  ✅ Configuration Supabase terminée !"
echo "============================================"
echo ""
echo "Étapes suivantes :"
echo "  1. Déployez sur Render.com :"
echo "     - Allez sur https://render.com"
echo "     - Créez un nouveau 'Web Service'"
echo "     - Connectez votre dépôt GitHub/GitLab"
echo "     - Dans Environment Variables, ajoutez :"
echo "       DATABASE_URL = $SUPABASE_URL"
echo "     - Build Command: bun run build"
echo "     - Start Command: bun run start"
echo ""
echo "  2. Ou déployez en local :"
echo "     bun run build && bun run start"
echo ""
echo "============================================"
