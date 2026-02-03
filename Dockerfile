# ============================================
# Dockerfile for PartyQuiz Web App (Next.js)
# ============================================

# Build arguments
ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=10.28.2

# Stage 1: Dependencies
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies including devDependencies (needed for build tools like Prisma, TypeScript, etc.)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Remove any cached Prisma Client and regenerate with binary engine
WORKDIR /app/apps/web
RUN rm -rf ../../node_modules/.prisma ../../node_modules/@prisma/client ./prisma/.cache ./.next
ENV PRISMA_ENGINE_TYPE=binary
RUN pnpm prisma generate

# Build Next.js app
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PRISMA_ENGINE_TYPE=binary
RUN pnpm --filter web build

# Stage 3: Runner
# Stage 3: Runner
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone Next.js output (self-contained with all dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema for migrations (if needed at runtime)
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js using the standalone server.js (includes everything needed)
CMD ["node", "apps/web/server.js"]