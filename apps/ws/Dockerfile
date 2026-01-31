# WebSocket Server Dockerfile for Coolify deployment

FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/ws/package.json ./apps/ws/

RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/ws/node_modules ./apps/ws/node_modules

COPY . .

WORKDIR /app/apps/ws
RUN pnpm build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 wsuser

COPY --from=builder --chown=wsuser:nodejs /app/apps/ws/dist ./dist
COPY --from=builder --chown=wsuser:nodejs /app/apps/ws/package.json ./package.json
COPY --from=builder --chown=wsuser:nodejs /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules

USER wsuser

EXPOSE 8080

ENV WS_PORT 8080

CMD ["node", "dist/index.js"]
