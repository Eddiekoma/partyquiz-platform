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

# Install ALL dependencies including devDependencies
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

# Generate Prisma Client for WS with binary engine
WORKDIR /app/apps/ws
RUN rm -rf ../../node_modules/.prisma ../../node_modules/@prisma/client
ENV PRISMA_ENGINE_TYPE=binary
RUN pnpm prisma generate

# Build TypeScript with tsup
WORKDIR /app
RUN pnpm --filter ws build

# Stage 3: Production Dependencies
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app

# Install pnpm
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/shared/package.json ./packages/shared/

# Copy shared package source (needed for workspace:* deps)
COPY packages/shared ./packages/shared

# Install ONLY production dependencies
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter ws...

# Stage 4: Runner
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Install pnpm (needed for workspace resolution)
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 socketio

# Copy workspace configuration files first
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./

# Copy production dependencies with proper structure
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages ./packages

# Copy WS app structure  
COPY --from=builder /app/apps/ws/package.json ./apps/ws/package.json
COPY --from=builder /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder /app/apps/ws/prisma ./apps/ws/prisma

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

# Start WebSocket server from root (so node_modules resolution works)
CMD ["node", "apps/ws/dist/index.js"]

