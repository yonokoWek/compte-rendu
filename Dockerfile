# ==============================================
# Compte Rendu - Docker Image
# Multi-stage build with Bun + Chromium
# ==============================================

# ---- Stage 1: Builder ----
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Install build dependencies for native modules (sharp, etc.)
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
RUN bunx prisma generate

# Copy source code
COPY . .

# Build Next.js standalone
# This also copies static + public into .next/standalone/
RUN bun run build

# ---- Stage 2: Runtime ----
FROM debian:bookworm-slim AS runner

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/chromium /usr/bin/google-chrome

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

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data && chown appuser:appuser /app/data

# Create tmp directory for PDF generation
RUN mkdir -p /tmp/pdf-gen && chown appuser:appuser /tmp/pdf-gen

# Tell Playwright to use system Chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# App environment
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/compte-rendu.db
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "server.js"]
