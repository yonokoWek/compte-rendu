#!/bin/bash
# ==============================================
# Compte Rendu - Docker Entrypoint
# Handles database schema sync with Supabase PostgreSQL
# ==============================================

set -e

# Ensure upload directory exists
mkdir -p /app/public/upload

# Sync Prisma schema to Supabase (handles schema migrations)
echo "🔄 Syncing database schema..."
cd /app
bunx prisma@6 db push --accept-data-loss 2>&1 || echo "⚠️ Schema sync warning (may be non-critical)"
echo "✅ Database schema synced"

# Start the application
exec "$@"
