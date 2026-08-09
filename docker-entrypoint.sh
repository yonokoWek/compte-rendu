#!/bin/bash
# ==============================================
# Compte Rendu - Docker Entrypoint
# Handles first-time database initialization
# ==============================================

set -e

# Create data directory if not exists
mkdir -p /app/data

# Initialize database if it doesn't exist
if [ ! -f "/app/data/compte-rendu.db" ]; then
    echo "🌱 Première initialisation de la base de données..."
    
    # Ensure prisma schema is available
    if [ -f "/app/prisma/schema.prisma" ]; then
        cd /app
        bunx prisma db push --accept-data-loss 2>/dev/null || true
        echo "✅ Base de données créée"
    fi
fi

# Ensure upload directory exists
mkdir -p /app/public/upload

# Start the application
exec "$@"
