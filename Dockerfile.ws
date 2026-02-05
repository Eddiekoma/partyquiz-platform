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

# Generate Prisma Client with binary engine (before building TypeScript)
WORKDIR /app/apps/ws
RUN rm -rf ../../node_modules/.prisma ../../node_modules/@prisma/client
ENV PRISMA_ENGINE_TYPE=binary
RUN pnpm prisma generate

# Build TypeScript with tsup (now with Prisma Client available)
WORKDIR /app
RUN pnpm --filter ws build

# Create production deployment directory with resolved dependencies
RUN mkdir -p /prod/ws

# Copy built application
RUN cp -r /app/apps/ws/dist /prod/ws/dist
RUN cp /app/apps/ws/package.json /prod/ws/package.json

# Copy Prisma schema (needed for generate command)
RUN cp -r /app/apps/ws/prisma /prod/ws/prisma

# Copy lockfile and workspace config for proper dependency resolution
RUN cp /app/pnpm-lock.yaml /prod/ws/pnpm-lock.yaml
RUN cp /app/pnpm-workspace.yaml /prod/ws/pnpm-workspace.yaml

# Install ONLY production dependencies in deployment directory
WORKDIR /prod/ws
RUN pnpm install --prod --frozen-lockfile --prefer-offline

# Generate Prisma Client in the production directory
# This ensures Prisma Client is in the correct location with correct dependencies
ENV PRISMA_ENGINE_TYPE=binary
RUN pnpm prisma generate

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

# Start WebSocket server (pnpm deploy puts everything in root)
CMD ["node", "dist/index.js"]

