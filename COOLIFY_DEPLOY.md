# 🚀 Coolify Deployment Guide

Complete step-by-step guide voor deploying PartyQuiz Platform naar Hetzner via Coolify met Cloudflare Tunnel.

## 📋 Prerequisites

- Hetzner VPS (minimaal 2 vCPU, 4GB RAM)
- Coolify geïnstalleerd op de VPS
- Cloudflare account met domein `databridge360.com`
- GitHub repository access
- Hetzner Object Storage bucket

## 🏗️ Architecture Overview

```
GitHub (main branch)
    ↓ (push trigger)
Coolify (Hetzner VPS)
    ├── Web App (Next.js) - Port 3000 (internal)
    ├── WebSocket Server - Port 8080 (internal)
    ├── PostgreSQL 16
    └── Redis 7
    ↓ (via Cloudflare Tunnel)
Cloudflare Tunnel
    ↓
https://partyquiz-platform.databridge360.com
    ├── / → Web App (port 3000)
    └── /ws → WebSocket Server (port 8080)
```

## 🎯 Deployment Steps

### 1. Coolify Resources Setup

#### A. Create PostgreSQL Database

1. In Coolify dashboard: **Resources** → **Add Resource** → **PostgreSQL**
2. Configure:
   - **Name**: `partyquiz-postgres`
   - **Version**: `16-alpine`
   - **Database**: `partyquiz`
   - **Username**: `partyquiz`
   - **Password**: *Generate strong password*
3. Click **Create**
4. Note the **Internal URL**: `postgresql://partyquiz:[password]@[internal-host]:5432/partyquiz`

#### B. Create Redis Instance

1. In Coolify: **Resources** → **Add Resource** → **Redis**
2. Configure:
   - **Name**: `partyquiz-redis`
   - **Version**: `7-alpine`
3. Click **Create**
4. Note the **Internal URL**: `redis://[internal-host]:6379`

### 2. GitHub Repository Connection

1. In Coolify: **Applications** → **Add Application**
2. Select **GitHub Repository**
3. Connect to: `your-org/partyquiz-platform`
4. Branch: `main`
5. Auto-deploy on push: **Enabled**

### 3. Deploy Web Application

#### A. Application Configuration

1. **Application Name**: `partyquiz-web`
2. **Build Pack**: Docker
3. **Dockerfile Location**: `apps/web/Dockerfile`
4. **Port**: `3000`
5. **Health Check Path**: `/api/healthz`

#### B. Environment Variables

Add the following environment variables in Coolify:

```bash
# Environment
NODE_ENV=production

# Database (use Coolify internal URL from step 1A)
DATABASE_URL=postgresql://partyquiz:[PASSWORD]@partyquiz-postgres:5432/partyquiz

# Redis (use Coolify internal URL from step 1B)
REDIS_URL=redis://partyquiz-redis:6379

# Auth (generate a strong secret: openssl rand -base64 32)
NEXTAUTH_SECRET=[GENERATED_SECRET]
NEXTAUTH_URL=https://partyquiz-platform.databridge360.com

# Application URLs
APP_BASE_URL=https://partyquiz-platform.databridge360.com
WS_BASE_URL=wss://partyquiz-platform.databridge360.com/ws

# Hetzner Object Storage (S3-compatible)
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=eu-central
S3_BUCKET=partyquiz-media
S3_ACCESS_KEY=[YOUR_ACCESS_KEY]
S3_SECRET_KEY=[YOUR_SECRET_KEY]
SPOTIFY_CLIENT_ID=[YOUR_SPOTIFY_CLIENT_ID]
SPOTIFY_CLIENT_SECRET=[YOUR_SPOTIFY_CLIENT_SECRET]
SPOTIFY_REDIRECT_URI=https://partyquiz-platform.databridge360.com/api/auth/spotify/callback

# Email (for magic links)
EMAIL_SMTP_HOST=smtp.yourprovider.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=[YOUR_SMTP_USER]
EMAIL_SMTP_PASS=[YOUR_SMTP_PASSWORD]
EMAIL_FROM=noreply@partyquiz-platform.databridge360.com
```

#### C. Build & Deploy

1. Click **Deploy**
2. Coolify will:
   - Clone the repository
   - Build Docker image using `apps/web/Dockerfile`
   - Run Prisma migrations (`prisma migrate deploy`)
   - Start the Next.js server on port 3000
3. Monitor logs for successful start
4. Verify health check: `GET /api/healthz` returns `{"status":"ok"}`

### 4. Deploy WebSocket Server

#### A. Application Configuration

1. **Application Name**: `partyquiz-ws`
2. **Build Pack**: Docker
3. **Dockerfile Location**: `apps/ws/Dockerfile`
4. **Port**: `8080`
5. **Health Check Path**: `/healthz`

#### B. Environment Variables

```bash
NODE_ENV=production
WS_PORT=8080
APP_BASE_URL=https://partyquiz-platform.databridge360.com
```

#### C. Build & Deploy

1. Click **Deploy**
2. Monitor logs
3. Verify health check: `GET /healthz` returns `{"status":"ok"}`

### 5. Cloudflare Tunnel Configuration

#### A. Install Cloudflare Tunnel (on Hetzner VPS)

SSH into your Hetzner VPS:

```bash
# Download cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login
```

#### B. Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create partyquiz

# Note the Tunnel ID from output
```

#### C. Configure Tunnel Routes

Create tunnel configuration file: `/etc/cloudflared/config.yml`

```yaml
tunnel: [YOUR_TUNNEL_ID]
credentials-file: /root/.cloudflared/[YOUR_TUNNEL_ID].json

ingress:
  # WebSocket path (must come first for path matching)
  - hostname: partyquiz-platform.databridge360.com
    path: /ws*
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
  
  # Main web app (catch-all)
  - hostname: partyquiz-platform.databridge360.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
  
  # Catch-all rule (required)
  - service: http_status:404
```

**Important Notes:**
- WebSocket route `/ws*` **MUST** come before the main app route
- `localhost:3000` and `localhost:8080` refer to Coolify's internal container ports
- `noTLSVerify: true` is OK here because TLS terminates at Cloudflare

#### D. Create DNS Record

In Cloudflare Dashboard:

1. Go to **DNS** → **Records**
2. Add **CNAME** record:
   - **Type**: CNAME
   - **Name**: `partyquiz-platform`
   - **Target**: `[TUNNEL_ID].cfargotunnel.com`
   - **Proxy status**: **Proxied** (orange cloud ON)
   - **TTL**: Auto
3. Click **Save**

#### E. Route DNS to Tunnel

```bash
cloudflared tunnel route dns partyquiz partyquiz-platform.databridge360.com
```

#### F. Start Tunnel Service

```bash
# Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

### 6. Verification

#### A. Test Web Application

```bash
curl https://partyquiz-platform.databridge360.com/api/healthz
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T...",
  "service": "web"
}
```

#### B. Test WebSocket Connection

Using a WebSocket client (wscat):

```bash
npm install -g wscat
wscat -c wss://partyquiz-platform.databridge360.com/ws
```

Should connect successfully.

#### C. Test Full Application

1. Open: `https://partyquiz-platform.databridge360.com`
2. Should see the landing page
3. Try signing in (magic link should work if email is configured)

### 7. Database Migrations

Migrations run automatically on deployment via the Dockerfile CMD.

To run manually:

```bash
# SSH into Coolify host
ssh root@your-hetzner-vps

# Access running web container
docker exec -it [web-container-id] sh

# Run migrations
cd apps/web
npx prisma migrate deploy
```

### 8. Seed Data (Optional)

To load demo data:

```bash
# In web container
cd apps/web
npx prisma db seed
```

This creates:
- Demo workspace: "Demo Workspace"
- Sample questions (all types)
- Sample quiz
- Test users

See `SEED.md` for details.

## 🔄 CI/CD Pipeline

### Automatic Deployment

Every push to `main` branch triggers:

1. GitHub webhook → Coolify
2. Coolify pulls latest code
3. Builds Docker images
4. Runs migrations (web app)
5. Restarts containers
6. Health checks verify deployment

### Manual Deployment

In Coolify dashboard:
1. Go to application (web or ws)
2. Click **Redeploy**
3. Monitor logs

### Rollback

To rollback to previous version:
1. In Coolify: **Deployments** tab
2. Select previous successful deployment
3. Click **Redeploy**

## 🐛 Troubleshooting

### Web App Not Accessible

1. **Check Coolify logs**:
   ```bash
   docker logs [web-container-id] -f
   ```

2. **Verify health check**:
   ```bash
   curl http://localhost:3000/api/healthz
   ```

3. **Check environment variables**:
   - Ensure `DATABASE_URL` is correct
   - Verify `NEXTAUTH_URL` uses HTTPS

### WebSocket Connection Fails

1. **Check WS server logs**:
   ```bash
   docker logs [ws-container-id] -f
   ```

2. **Verify WS health check**:
   ```bash
   curl http://localhost:8080/healthz
   ```

3. **Check Cloudflare Tunnel config**:
   - Ensure `/ws*` route comes first
   - Verify tunnel is running: `sudo systemctl status cloudflared`

4. **Test WebSocket upgrade**:
   ```bash
   wscat -c ws://localhost:8080
   ```

### Database Connection Issues

1. **Check PostgreSQL is running**:
   ```bash
   docker ps | grep postgres
   ```

2. **Verify DATABASE_URL**:
   - Check internal hostname
   - Verify password
   - Test connection: `psql $DATABASE_URL`

3. **Check migrations**:
   ```bash
   npx prisma migrate status
   ```

### Cloudflare Tunnel Issues

1. **Check tunnel status**:
   ```bash
   sudo systemctl status cloudflared
   sudo journalctl -u cloudflared -f
   ```

2. **Verify DNS record**:
   - CNAME points to `[TUNNEL_ID].cfargotunnel.com`
   - Proxy is **enabled** (orange cloud)

3. **Test tunnel connectivity**:
   ```bash
   cloudflared tunnel info partyquiz
   ```

4. **Restart tunnel**:
   ```bash
   sudo systemctl restart cloudflared
   ```

### Migration Failures

1. **Check migration status**:
   ```bash
   cd apps/web
   npx prisma migrate status
   ```

2. **Resolve conflicts**:
   ```bash
   npx prisma migrate resolve --applied [migration-name]
   ```

3. **Reset database** (DEV ONLY):
   ```bash
   npx prisma migrate reset
   ```

## 🔒 Security Checklist

- [ ] Strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] PostgreSQL password is strong and secret
- [ ] S3 credentials are kept secret
- [ ] Email SMTP credentials secured
- [ ] Spotify client secret secured
- [ ] Rate limiting enabled (built-in)
- [ ] HTTPS enforced (via Cloudflare)
- [ ] Audit logging enabled
- [ ] Backups configured (see below)

## 💾 Backups

### Database Backups

Setup automated daily backups:

```bash
# Create backup script
cat > /root/backup-partyquiz.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/partyquiz"
mkdir -p $BACKUP_DIR

docker exec partyquiz-postgres pg_dump -U partyquiz partyquiz | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /root/backup-partyquiz.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /root/backup-partyquiz.sh" | crontab -
```

### Object Storage Backup

Hetzner Object Storage has built-in redundancy. For extra safety:

1. Enable versioning on the bucket
2. Setup lifecycle rules for old versions
3. Optional: sync to another provider (AWS S3, etc.)

## 📊 Monitoring

### Health Checks

Coolify automatically monitors:
- Web app: `GET /api/healthz` every 30s
- WS server: `GET /healthz` every 30s

### Logs

View logs in Coolify dashboard or via SSH:

```bash
# Web app
docker logs [web-container-id] -f

# WebSocket server
docker logs [ws-container-id] -f

# PostgreSQL
docker logs partyquiz-postgres -f

# Redis
docker logs partyquiz-redis -f

# Cloudflare Tunnel
sudo journalctl -u cloudflared -f
```

### Metrics (Optional)

For production monitoring, consider adding:
- **Sentry** for error tracking
- **Plausible/Umami** for analytics
- **Uptime Kuma** for uptime monitoring

## 🎉 Success Criteria

Deployment is successful when:

- ✅ Web app accessible at `https://partyquiz-platform.databridge360.com`
- ✅ Health check returns `{"status":"ok"}`
- ✅ WebSocket connects via `wss://partyquiz-platform.databridge360.com/ws`
- ✅ Database migrations completed
- ✅ Can create user account (magic link works)
- ✅ Can create workspace
- ✅ Can upload media (S3 working)
- ✅ All environment variables configured
- ✅ HTTPS certificate valid (Cloudflare)
- ✅ Logs show no errors

---

**Questions or issues?** Check logs first, then refer to troubleshooting section above.

**Production URL:** https://partyquiz-platform.databridge360.com
