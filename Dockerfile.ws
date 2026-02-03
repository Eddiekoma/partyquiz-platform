# ============================================
# Dockerfile for PartyQuiz WebSocket Server
# ============================================

# Stage 1: Dependencies (ALL deps for building)
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies including devDependencies
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/ws/node_modules ./apps/ws/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy all source code
COPY . .

# Generate Prisma Client for WS
WORKDIR /app/apps/ws
RUN rm -rf ../../node_modules/.prisma ../../node_modules/@prisma/client
RUN pnpm prisma generate

# Build TypeScript with tsup
WORKDIR /app
RUN pnpm --filter ws build

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

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
FROM node:20-alpine AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 socketio

# Copy production dependencies and Prisma Client
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/ws/node_modules ./apps/ws/node_modules
COPY --from=prod-deps /app/packages ./packages

# Copy built application
COPY --from=builder /app/apps/ws/dist ./dist
COPY --from=builder /app/apps/ws/prisma ./prisma
COPY --from=builder /app/apps/ws/package.json ./package.json

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

# Start WebSocket server
CMD ["node", "dist/index.js"]

