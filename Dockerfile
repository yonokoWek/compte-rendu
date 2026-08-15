# ==============================================
# Compte Rendu - Docker Image
# Multi-stage build with Bun for Render.com + Supabase PostgreSQL
# ==============================================

# ---- Stage 1: Builder ----
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Install build dependencies for native modules (sharp, pg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma/
RUN bunx prisma@6 generate

# Copy source code
COPY . .

# Build Next.js standalone
RUN bun run build

# ---- Stage 2: Runtime ----
FROM debian:bookworm-slim AS runner

# Install minimal runtime dependencies (fonts for PDF rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto \
    fonts-noto-cjk \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Bun runtime
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && rm -rf /root/.bun

# Create non-root user for security
RUN groupadd --gid 1001 appuser && useradd --uid 1001 --gid appuser --create-home appuser

WORKDIR /app

# Copy standalone output from builder (already includes static + public)
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./

# Copy Prisma schema (for db push if needed at runtime)
COPY --from=builder --chown=appuser:appuser /app/prisma ./prisma

# Copy generated Prisma client (may not be in standalone trace)
COPY --from=builder --chown=appuser:appuser /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma runtime packages
COPY --from=builder --chown=appuser:appuser /app/node_modules/@prisma ./node_modules/@prisma

# Copy prisma CLI for runtime db init
COPY --from=builder --chown=appuser:appuser /app/node_modules/prisma ./node_modules/prisma

# Copy pg runtime
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-native ./node_modules/pg-native 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-protocol ./node_modules/pg-protocol 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-types ./node_modules/pg-types 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-pool ./node_modules/pg-pool 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-cursor ./node_modules/pg-cursor 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-packet-stream ./node_modules/pg-packet-stream 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/pg-connection-string ./node_modules/pg-connection-string 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/buffer-writer ./node_modules/buffer-writer 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/object-assign ./node_modules/object-assign 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/split2 ./node_modules/split2 2>/dev/null || true
COPY --from=builder --chown=appuser:appuser /app/node_modules/readable-stream ./node_modules/readable-stream 2>/dev/null || true

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create upload directory
RUN mkdir -p /app/public/upload && chown appuser:appuser /app/public/upload

# App environment
ENV NODE_ENV=production
ENV PORT=10000

# Expose port (Render free tier uses dynamic port from PORT env)
EXPOSE 10000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/ || exit 1

# Start the application via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "server.js"]
