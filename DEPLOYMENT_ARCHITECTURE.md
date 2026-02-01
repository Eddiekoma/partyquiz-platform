# 🏗️ Deployment Architecture

## Overview

PartyQuiz Platform gebruikt een **hybrid deployment approach**:

- **Local Development**: Docker Compose voor PostgreSQL + Redis
- **Production**: Coolify-managed resources op Hetzner VPS

Deze scheiding zorgt voor:
- ✅ Eenvoudige lokale development (één commando: `docker-compose up -d`)
- ✅ Professional production setup met managed databases
- ✅ Persistent data en backups in productie
- ✅ Makkelijke scaling en maintenance

## 📊 Architecture Comparison

### Local Development

```
┌─────────────────────────────────────────┐
│ Docker Compose                          │
│                                         │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ PostgreSQL   │  │ Redis          │  │
│  │ :5432        │  │ :6379          │  │
│  │              │  │                │  │
│  │ Volume:      │  │ Volume:        │  │
│  │ postgres_data│  │ redis_data     │  │
│  └──────────────┘  └────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
         ↑                    ↑
         │                    │
    ┌────┴────┐          ┌────┴────┐
    │ Web App │          │ WS App  │
    │ :3000   │          │ :8080   │
    │ (local) │          │ (local) │
    └─────────┘          └─────────┘
```

**Files:**
- `docker-compose.yml` - Defines PostgreSQL + Redis services
- `apps/web/.env.local` - Local environment variables
- `apps/ws/.env.local` - Local WS environment variables

**Commands:**
```bash
# Start databases
docker-compose up -d

# Stop databases
docker-compose down

# View logs
docker-compose logs -f

# Reset data (DANGEROUS - destroys all data)
docker-compose down -v
```

**Connection Strings (Local):**
```bash
DATABASE_URL="postgresql://partyquiz:partyquiz_dev_password@localhost:5432/partyquiz"
REDIS_URL="redis://localhost:6379"
```

### Production (Coolify)

```
┌─────────────────────────────────────────────────────────────┐
│ Coolify (Hetzner VPS)                                       │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ PostgreSQL 16  │  │ Redis 7        │  │ Web App      │ │
│  │ Managed        │  │ Managed        │  │ (Docker)     │ │
│  │ Resource       │  │ Resource       │  │ Port: 3000   │ │
│  │                │  │                │  │              │ │
│  │ ✓ Backups      │  │ ✓ Persistence  │  │ Healthcheck: │ │
│  │ ✓ Monitoring   │  │ ✓ Monitoring   │  │ /api/healthz │ │
│  │ ✓ Auto-restart │  │ ✓ Auto-restart │  └──────────────┘ │
│  └────────────────┘  └────────────────┘                    │
│                                          ┌──────────────┐  │
│                                          │ WS Server    │  │
│                                          │ (Docker)     │  │
│                                          │ Port: 8080   │  │
│                                          │              │  │
│                                          │ Healthcheck: │  │
│                                          │ /healthz     │  │
│                                          └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
                ┌──────────────────────┐
                │ Cloudflare Tunnel    │
                │                      │
                │ Routes:              │
                │ /ws/* → :8080        │
                │ /*    → :3000        │
                └──────────────────────┘
                           ↓
                  🌐 partyquiz-platform.databridge360.com
```

**Resources in Coolify:**
1. **PostgreSQL Resource** (`partyquiz-postgres`)
   - Type: One-Click Database
   - Version: 16-alpine
   - Persistent volume
   - Internal network only
   - Managed backups

2. **Redis Resource** (`partyquiz-redis`)
   - Type: One-Click Database
   - Version: 7-alpine
   - Persistent volume
   - Internal network only

3. **Web Application** (`partyquiz-web`)
   - Type: Docker Application
   - Dockerfile: `apps/web/Dockerfile`
   - Port: 3000
   - Auto-deploy from GitHub (main branch)

4. **WebSocket Server** (`partyquiz-ws`)
   - Type: Docker Application
   - Dockerfile: `apps/ws/Dockerfile`
   - Port: 8080
   - Auto-deploy from GitHub (main branch)

**Connection Strings (Production):**
```bash
# Coolify provides internal DNS names
DATABASE_URL="postgresql://partyquiz:[PASSWORD]@partyquiz-postgres:5432/partyquiz"
REDIS_URL="redis://partyquiz-redis:6379"
```

## 🔄 Why This Approach?

### ❌ What We DON'T Do (Alternative Approaches)

**Option 1: Docker Compose in Production**
```yaml
# docker-compose.production.yml (NOT USED)
services:
  web:
    build: ./apps/web
  postgres:
    image: postgres:16
  redis:
    image: redis:7
```

**Problems:**
- ❌ Data loss bij container rebuild
- ❌ Geen managed backups
- ❌ Complexe orchestration
- ❌ Moeilijk te schalen

**Option 2: Database in Web Container**
```dockerfile
# Dockerfile.monolith (NOT USED)
FROM node:20-alpine
RUN apk add postgresql redis
# Install both app AND database in one container
```

**Problems:**
- ❌ Anti-pattern (violates single responsibility)
- ❌ Data loss bij redeploy
- ❌ Kan niet onafhankelijk schalen
- ❌ Backup nightmare

### ✅ What We DO (Coolify Managed Resources)

**Advantages:**

1. **Data Persistence**
   - Database blijft bestaan bij web app redeployment
   - Volume management handled by Coolify
   - Geen data loss bij updates

2. **Backups**
   - Coolify automated backups voor PostgreSQL
   - Easy restore via UI
   - Snapshot functionaliteit

3. **Monitoring**
   - Built-in healthchecks
   - Resource usage metrics
   - Auto-restart bij crashes

4. **Scaling**
   - Database kan onafhankelijk geschaald worden
   - Redis kan separate instance krijgen
   - Web app kan meerdere instances hebben

5. **Security**
   - Internal network only (niet exposed)
   - Coolify managed credentials
   - No public ports

6. **Maintenance**
   - Easy upgrades (PostgreSQL 16 → 17)
   - No downtime voor web app bij DB maintenance
   - Separate update cycles

## 🚀 Deployment Workflow

### Initial Setup (One-time)

```bash
1. Create Coolify Resources
   ├── PostgreSQL (get DATABASE_URL)
   ├── Redis (get REDIS_URL)
   └── Note credentials

2. Configure Applications
   ├── Connect GitHub repo
   ├── Set environment variables
   └── Configure build settings

3. Deploy Applications
   ├── Web app (migrations run automatically)
   └── WebSocket server

4. Setup Cloudflare Tunnel
   ├── Install cloudflared
   ├── Configure routes
   └── Point DNS

5. Verify Deployment
   ├── Test health endpoints
   ├── Test database connection
   └── Test live session (WebSocket)
```

### Regular Updates (CI/CD)

```bash
Developer pushes to main
     ↓
GitHub webhook → Coolify
     ↓
Coolify pulls latest code
     ↓
Build Docker images
     ↓
Run migrations (web app)
     ↓
Rolling restart
     ↓
Health checks verify
     ↓
✅ Deployment complete
```

**Database staat NIET in deze flow** - blijft draaien, geen downtime!

## 📦 Migration Strategy

### Development → Staging → Production

```bash
# 1. Create migration locally
cd apps/web
pnpm prisma migrate dev --name add_feature_x

# 2. Test locally (uses Docker Compose DB)
pnpm dev
# Verify feature works

# 3. Commit migration
git add prisma/migrations/
git commit -m "feat: add feature X migration"

# 4. Push to GitHub
git push origin main

# 5. Coolify auto-deploys
# - Builds new image
# - Runs: prisma migrate deploy (production-safe)
# - Restarts app

# 6. Verify in production
curl https://partyquiz-platform.databridge360.com/api/healthz
```

**Key Points:**
- ✅ `migrate dev` in local (generates migration)
- ✅ `migrate deploy` in production (applies migration, no prompts)
- ✅ Database credentials managed by Coolify
- ✅ Rollback via Coolify UI (redeploy previous version)

## 🔧 Configuration Files

### docker-compose.yml (Local Development ONLY)

```yaml
# This file is ONLY used for local development
# Production uses Coolify managed resources
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: partyquiz
      POSTGRES_PASSWORD: partyquiz_dev_password
      POSTGRES_DB: partyquiz

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**Usage:**
```bash
# Start for local dev
docker-compose up -d

# NOT used in production
# (Coolify manages databases separately)
```

### Dockerfile (Production)

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm prisma generate
RUN pnpm build

# Run migrations on startup, then start app
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
```

**Key:** `prisma migrate deploy` runs automatically when container starts.

## 🔐 Environment Variables

### Local (.env.local)

```bash
# Use localhost (Docker Compose)
DATABASE_URL="postgresql://partyquiz:partyquiz_dev_password@localhost:5432/partyquiz"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"
```

### Production (Coolify)

```bash
# Use Coolify internal DNS
DATABASE_URL="postgresql://partyquiz:[STRONG_PASSWORD]@partyquiz-postgres:5432/partyquiz"
REDIS_URL="redis://partyquiz-redis:6379"
NEXTAUTH_URL="https://partyquiz-platform.databridge360.com"
NEXTAUTH_SECRET="[GENERATED_32_CHAR_SECRET]"
```

**Notice:**
- Local: `localhost:5432` (exposed port)
- Production: `partyquiz-postgres:5432` (internal DNS)

## 🎯 Best Practices

### ✅ DO

1. **Use Docker Compose for local development**
   ```bash
   docker-compose up -d  # Start databases
   pnpm dev              # Start apps
   ```

2. **Use Coolify managed resources in production**
   - Create PostgreSQL resource first
   - Create Redis resource second
   - Deploy apps last (use internal URLs)

3. **Keep migrations in Git**
   ```bash
   git add prisma/migrations/
   git commit -m "migration: ..."
   ```

4. **Test migrations locally first**
   ```bash
   pnpm prisma migrate dev
   # Test thoroughly
   git push  # Deploy to prod
   ```

5. **Use environment-specific configs**
   - `.env.local` for development
   - Coolify env vars for production

### ❌ DON'T

1. **Don't use docker-compose.yml in production**
   - It's only for local dev
   - Coolify handles orchestration

2. **Don't expose database ports in production**
   - Use internal network only
   - Coolify handles DNS

3. **Don't hardcode connection strings**
   - Use environment variables
   - Let Coolify inject values

4. **Don't run `migrate dev` in production**
   - Use `migrate deploy` (happens automatically)
   - `migrate dev` is interactive (prompts)

5. **Don't commit .env files**
   - Use `.env.example` templates
   - Set real values in Coolify UI

## 📚 Related Documentation

- [COOLIFY_DEPLOY.md](./COOLIFY_DEPLOY.md) - Complete deployment guide
- [README.md](./README.md) - Local development setup
- [SEED.md](./SEED.md) - Database seeding
- [TESTING.md](./TESTING.md) - Testing strategy

## 🆘 Troubleshooting

### Local Development

**Problem:** Can't connect to database

```bash
# Check if containers are running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart containers
docker-compose restart
```

**Problem:** Port 5432 already in use

```bash
# Find process using port
lsof -i :5432

# Stop existing PostgreSQL
brew services stop postgresql  # macOS
# or
sudo systemctl stop postgresql  # Linux
```

### Production

**Problem:** Migration fails on deploy

```bash
# Check web app logs in Coolify
# Look for Prisma errors

# SSH into Coolify host
ssh root@your-vps

# Check running containers
docker ps

# View migration status
docker exec -it partyquiz-web sh
cd /app/apps/web
npx prisma migrate status
```

**Problem:** Can't connect to database from app

```bash
# Verify DATABASE_URL in Coolify env vars
# Should use internal DNS: partyquiz-postgres:5432

# Test connection from web container
docker exec -it partyquiz-web sh
nc -zv partyquiz-postgres 5432
```

---

**Summary:** Local development uses Docker Compose for simplicity. Production uses Coolify managed resources for reliability, backups, and scalability. Best of both worlds! 🎉
