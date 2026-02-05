# ============================================
# Dockerfile for PartyQuiz WebSocket Server
# ============================================

# Build arguments
ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=10.28.2

# Stage 1: Dependencies (ALL deps for building)
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies including devDependencies (needed for Prisma, TypeScript, tsup, etc.)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/ws/node_modules ./apps/ws/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy all source code
COPY . .

# Build shared package first (required by WS app)
WORKDIR /app
RUN pnpm --filter @partyquiz/shared build

# Generate Prisma Client for Prisma 7 (before building TypeScript)
# Prisma 7 requires prisma.config.ts which needs tsx to parse
WORKDIR /app/apps/ws
RUN rm -rf ../../node_modules/.prisma ../../node_modules/@prisma/client

# For Prisma 7: Generate client using the config file
# tsx is available via devDependencies for parsing prisma.config.ts
RUN pnpm exec prisma generate

# Build TypeScript with tsup (now with Prisma Client available)
WORKDIR /app
RUN pnpm --filter ws build

# Use pnpm deploy to create standalone production directory
# This is the KEY: pnpm deploy resolves workspace:* dependencies automatically
# It runs in workspace context (/app) so it knows where @partyquiz/shared is
# Then creates a standalone directory with all production dependencies resolved
RUN pnpm --filter ws --prod deploy /prod/ws

# Copy files that pnpm deploy doesn't include:
# 1. dist/ - our built TypeScript output
RUN cp -r /app/apps/ws/dist /prod/ws/dist

# 2. prisma/ - Copy from WEB app (single source of truth for schema + migrations)
#    WS app no longer has its own prisma folder - it uses web's schema
RUN cp -r /app/apps/web/prisma /prod/ws/prisma

# 3. prisma.config.mjs - Prisma 7 requires this for migrate deploy (using .mjs for runtime without tsx)
RUN cp /app/apps/ws/prisma.config.mjs /prod/ws/prisma.config.mjs

# 4. CRITICAL: Copy generated Prisma Client from workspace build
# pnpm deploy doesn't include generated files, so we copy from the workspace build
# Prisma Client is in the pnpm virtual store at a path like:
# /app/node_modules/.pnpm/@prisma+client@7.3.0_prisma@7.3.0_typescript@5.9.3/node_modules/@prisma/client
# .prisma generated folder is also in the pnpm store
RUN mkdir -p /prod/ws/node_modules/@prisma && \
    PRISMA_CLIENT_DIR=$(find /app/node_modules/.pnpm -type d -path "*/node_modules/@prisma/client" | head -1) && \
    cp -r "$PRISMA_CLIENT_DIR" /prod/ws/node_modules/@prisma/client && \
    PRISMA_GENERATED_DIR=$(find /app/node_modules/.pnpm -type d -name ".prisma" | head -1) && \
    cp -r "$PRISMA_GENERATED_DIR" /prod/ws/node_modules/.prisma

# Stage 3: Runner
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 socketio

# Copy deployed app with resolved dependencies (no symlinks!)
COPY --from=builder /prod/ws .

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

USER socketio

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run migrations and start WebSocket server
# Debug: print env vars (masked) and schema location before running migrations
# Prisma 7: Uses prisma.config.mjs for configuration (auto-detected)
CMD ["sh", "-c", "echo '=== Startup Debug ===' && \
     echo 'DATABASE_URL available:' $(test -n \"$DATABASE_URL\" && echo 'YES' || echo 'NO') && \
     echo 'REDIS_URL available:' $(test -n \"$REDIS_URL\" && echo 'YES' || echo 'NO') && \
     echo 'Working directory:' $(pwd) && \
     echo 'Prisma schema exists:' $(test -f ./prisma/schema.prisma && echo 'YES' || echo 'NO') && \
     echo 'Prisma config exists:' $(test -f ./prisma.config.mjs && echo 'YES' || echo 'NO') && \
     echo 'Prisma migrations dir:' $(test -d ./prisma/migrations && echo 'YES' || echo 'NO') && \
     echo '===================' && \
     npx prisma migrate deploy && \
     node dist/index.js"]

