# PartyQuiz Platform - Production Deployment Strategy

## 🏗️ Docker Multi-Stage Build Architecture

### Web App (Next.js) - `Dockerfile`
```
deps → builder → runner
```

**Stage 1: deps**
- Node 20 Alpine
- Install pnpm 10.28.2
- Install ALL dependencies (dev + prod) met `NODE_ENV=development`
- Cached voor snelle rebuilds

**Stage 2: builder**  
- Build `@partyquiz/shared` package
- Generate Prisma Client (binary engine)
- Build Next.js standalone mode
- Output: Self-contained `.next/standalone/` directory

**Stage 3: runner**
- Minimal Alpine image
- Copy standalone output + static assets
- Run as non-root user (nextjs:nodejs)
- Healthcheck op `/healthz`
- Start met `dumb-init` voor proper signal handling

---

### WebSocket Server - `Dockerfile.ws`
```
deps → builder → runner
```

**Stage 1: deps**
- Identiek aan web app
- Install ALL dependencies inclusief Prisma, TypeScript, tsup

**Stage 2: builder**
- Build `@partyquiz/shared` package  
- Generate Prisma Client (binary engine)
- Build WS app met tsup
- **KRITIEKE STAP**: 
  1. Kopieer dist + package.json + prisma schema naar `/prod/ws`
  2. Install PROD dependencies in `/prod/ws`
  3. Generate Prisma Client IN `/prod/ws` (correcte locatie!)

**Stage 3: runner**
- Copy complete `/prod/ws` directory
- Run as non-root user (socketio:nodejs)
- Healthcheck op port 8080
- Start met `dumb-init`

---

## 🔑 Key Learnings & Best Practices

### ✅ DO's

1. **Multi-stage builds zijn essentieel**
   - Scheidt build deps van runtime deps
   - Resulteert in ~80% kleinere images

2. **Prisma Client genereren OP JUISTE LOCATIE**
   - Web: Generate in build context, Next.js standalone kopieert automatisch
   - WS: Generate IN production directory `/prod/ws`
   - Anders: `Cannot find module '.prisma/client/default'` error

3. **pnpm monorepo handling**
   - Altijd `NODE_ENV=development` tijdens deps install
   - Build shared package VOOR dependent apps
   - Gebruik `pnpm --filter` voor selective builds

4. **Security & Reliability**
   - Non-root users (nextjs, socketio)
   - Binary engine type voor Prisma (kleinere images)
   - dumb-init voor proper signal handling
   - Healthchecks voor zero-downtime deployments

### ❌ DON'Ts

1. **NOOIT `pnpm --prod deploy` gebruiken zonder Prisma regenerate**
   - `pnpm deploy` kopieert GEEN `.prisma/` generated files
   - Altijd daarna `pnpm prisma generate` in deploy directory

2. **NOOIT `COPY --from=builder` binnen builder stage**
   - Veroorzaakt circular dependency errors
   - Gebruik `RUN cp` binnen dezelfde stage

3. **NOOIT Prisma genereren zonder binary engine in Docker**
   ```dockerfile
   ENV PRISMA_ENGINE_TYPE=binary  # Altijd!
   ```

4. **NOOIT ES Module named imports voor Prisma in pnpm monorepo**
   ```typescript
   // ❌ FOUT
   import { PrismaClient } from "@prisma/client";
   
   // ✅ GOED  
   import prismaClientPkg from "@prisma/client";
   const { PrismaClient } = prismaClientPkg;
   ```

---

## 📊 Deployment Flow (Coolify)

1. **Git Push naar main branch**
   ```bash
   git push origin main
   ```

2. **Coolify detecteert commit** (binnen 30 sec)

3. **Parallel builds**:
   - Web: `Dockerfile` → `partyquiz-web`
   - WS: `Dockerfile.ws` → `partyquiz-ws`

4. **Rolling updates**:
   - Build new container
   - Run healthcheck (start-period: 10s, interval: 30s)
   - Als healthy: Switch traffic
   - Als unhealthy: Rollback automatisch

5. **Services beschikbaar**:
   - Web: https://partyquiz.databridge360.com
   - WS: wss://ws.partyquiz.databridge360.com

---

## 🔧 Environment Variables (Coolify)

### Database Connections
```bash
# PostgreSQL (internal Docker network)
DATABASE_URL=postgres://postgres:***@r00oss4cggks40c48c0kg8o8:5432/postgres

# Redis (internal Docker network)  
REDIS_URL=redis://default:***@zwgsko8kc4kg4csgg440co08:6379/0
```

### Application Config
```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PRISMA_ENGINE_TYPE=binary

# NextAuth
NEXTAUTH_SECRET=***
NEXTAUTH_URL=https://partyquiz.databridge360.com

# App URLs
APP_BASE_URL=https://partyquiz.databridge360.com
WS_BASE_URL=wss://ws.partyquiz.databridge360.com

# Cloudflare R2
S3_ENDPOINT=***
S3_REGION=auto
S3_BUCKET=partyquiz-media
S3_ACCESS_KEY=***
S3_SECRET_KEY=***
```

---

## 🚀 Success Criteria

- ✅ Web container healthy (healthcheck passed)
- ✅ WS container healthy (healthcheck passed)  
- ✅ Prisma Client loads without errors
- ✅ Database migrations applied
- ✅ Redis connections established
- ✅ WebSocket connections accepted
- ✅ Real-time quiz sessions functional

---

## 📝 Troubleshooting

### Container crasht met "Cannot find module .prisma/client"
→ Prisma Client niet gegenereerd in correcte directory  
→ Check: `pnpm prisma generate` IN production directory

### Build faalt met "circular dependency"
→ Gebruik `RUN cp` in plaats van `COPY --from=builder` binnen stage

### Healthcheck faalt na 3 retries
→ Check container logs: `docker logs <container_id>`  
→ Verify env vars correct zijn (DATABASE_URL, REDIS_URL)

### "Named export 'PrismaClient' not found"
→ ES Module import issue in pnpm monorepo  
→ Gebruik default import pattern (zie DON'Ts)

---

*Laatst geüpdatet: 2026-02-04*  
*Commit: d5c11ec*
