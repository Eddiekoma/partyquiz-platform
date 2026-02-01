# 🧪 Lokaal Testen met Coolify Databases

**Scenario:** Je hebt PostgreSQL + Redis op Coolify (Hetzner VPS), wilt lokaal ontwikkelen/testen.

---

## Stap 1: Haal Coolify Database Credentials Op

### In Coolify Dashboard:

**PostgreSQL:**
1. Ga naar je PostgreSQL resource
2. Kopieer connection string:
   ```
   postgresql://[username]:[password]@[host]:[port]/[database]
   ```
   Bijvoorbeeld:
   ```
   postgresql://partyquiz:abc123xyz@db.coolify.io:5432/partyquiz_prod
   ```

**Redis:**
1. Ga naar je Redis resource
2. Kopieer connection string:
   ```
   redis://[host]:[port]
   ```
   Of met wachtwoord:
   ```
   redis://:[password]@[host]:[port]
   ```

---

## Stap 2: Maak `.env` Bestand

```bash
# In project root
cp .env.example .env
```

**Edit `.env` met deze settings:**

```bash
# ============================================
# DATABASE (Coolify Managed PostgreSQL)
# ============================================
DATABASE_URL="postgresql://partyquiz:JE_WACHTWOORD@db.coolify.io:5432/partyquiz_prod"

# ============================================
# REDIS (Coolify Managed Redis)
# ============================================
REDIS_URL="redis://redis.coolify.io:6379"
# Of met wachtwoord:
# REDIS_URL="redis://:JE_REDIS_PASSWORD@redis.coolify.io:6379"

# ============================================
# NEXTAUTH (Lokaal)
# ============================================
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="GENEREER_DIT_HIERONDER"

# ============================================
# EMAIL (Test met Ethereal - GRATIS)
# ============================================
EMAIL_FROM="test@partyquiz.com"
EMAIL_SERVER_HOST="smtp.ethereal.email"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="krijg-je-van-ethereal"
EMAIL_SERVER_PASSWORD="krijg-je-van-ethereal"

# ============================================
# SPOTIFY (Optioneel - voor muziek vragen)
# ============================================
SPOTIFY_CLIENT_ID="je_spotify_client_id"
SPOTIFY_CLIENT_SECRET="je_spotify_secret"
SPOTIFY_REDIRECT_URI="http://localhost:3000/api/spotify/callback"

# ============================================
# YOUTUBE (Optioneel - voor video vragen)
# ============================================
YOUTUBE_API_KEY="je_youtube_api_key"

# ============================================
# HETZNER S3 (Optioneel - voor uploads)
# ============================================
S3_ENDPOINT="https://fsn1.your-objectstorage.com"
S3_BUCKET_NAME="partyquiz"
S3_ACCESS_KEY_ID="je_access_key"
S3_SECRET_ACCESS_KEY="je_secret_key"
S3_REGION="eu-central-1"
```

---

## Stap 3: Genereer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

**Output bijvoorbeeld:**
```
K8fJ2mN9pQ4rS7tV1wX3yZ5aB8cD0eF2
```

Kopieer deze naar `.env` bij `NEXTAUTH_SECRET=`

---

## Stap 4: Setup Ethereal Email (Gratis Test SMTP)

**Waarom Ethereal?**
- ✅ GRATIS test email server
- ✅ Geen echte emails verzonden (alleen voor testen)
- ✅ Zie alle "verzonden" emails in web interface
- ✅ Perfect voor magic link testen

**Setup (30 seconden):**

1. Ga naar: **https://ethereal.email/create**
2. Klik "Create Ethereal Account"
3. Je krijgt credentials:
   ```
   Host: smtp.ethereal.email
   Port: 587
   Username: ethel.johns@ethereal.email
   Password: x8K2mN4pQ9R
   ```
4. Kopieer deze naar `.env`:
   ```bash
   EMAIL_SERVER_USER="ethel.johns@ethereal.email"
   EMAIL_SERVER_PASSWORD="x8K2mN4pQ9R"
   ```

**Emails bekijken:**
- Ga naar: **https://ethereal.email/messages**
- Login met je Ethereal account
- Zie alle "verzonden" magic links

---

## Stap 5: Verifieer Database Connectie

```bash
cd apps/web

# Test database connectie
pnpm prisma db pull
```

**Verwachte output:**
```
✔ Introspected 23 models and wrote them into prisma/schema.prisma
```

**Als dit werkt:** ✅ Database connectie succesvol!

**Als error:** ❌ Check DATABASE_URL in .env

---

## Stap 6: Database Schema Synchroniseren

**Als database leeg is (eerste keer):**
```bash
pnpm prisma migrate deploy
```

**Als database al schema heeft:**
```bash
pnpm prisma db push
```

**Expected:**
```
✔ Database synchronized
```

---

## Stap 7: Seed Test Data

```bash
pnpm prisma db seed
```

**Verwachte output:**
```
✔ Created 3 template quizzes
✔ Created 24 sample questions
✔ Created test workspace
```

---

## Stap 8: Start Development Servers

### Terminal 1 - Web App (Next.js)

```bash
cd apps/web
pnpm dev
```

**Verwachte output:**
```
  ▲ Next.js 14.x
  - Local:        http://localhost:3000
  - Network:      http://192.168.1.x:3000

✓ Ready in 2.3s
```

### Terminal 2 - WebSocket Server

```bash
cd apps/ws
pnpm dev
```

**Verwachte output:**
```
[WebSocket] Server running on http://localhost:3001
[WebSocket] Redis connected
[WebSocket] Game loop started (60 FPS)
```

---

## Stap 9: Test de Setup

### Test 1: Web App Draait

1. Open browser: **http://localhost:3000**
2. ✅ Zie "PartyQuiz Platform" homepage
3. ✅ Klik "Sign In"
4. ✅ Zie sign-in page

### Test 2: Database Connectie

1. In sign-in page, vul email in: `test@example.com`
2. Klik "Send Magic Link"
3. ✅ Zie "Check your email" bericht

### Test 3: Magic Link Email

1. Ga naar: **https://ethereal.email/messages**
2. ✅ Zie email "Sign in to PartyQuiz Platform"
3. ✅ Open email, zie magic link
4. ✅ Klik link → redirect naar dashboard

### Test 4: WebSocket Connectie

1. Open DevTools (F12) → Console
2. In dashboard, ga naar "Create Session"
3. ✅ Zie in console: `[WebSocket] Connected to ws://localhost:3001`

---

## ✅ Success Criteria

Als deze allemaal werken, is je lokale setup compleet:

- [x] Database connectie (Coolify PostgreSQL)
- [x] Redis connectie (Coolify Redis)
- [x] Web app draait (localhost:3000)
- [x] WebSocket server draait (localhost:3001)
- [x] Magic link emails (Ethereal)
- [x] Dashboard toegankelijk

---

## 🐛 Troubleshooting

### Error: "Can't reach database server"

**Oorzaak:** Coolify database niet bereikbaar vanaf lokaal

**Oplossingen:**

1. **Check Coolify Firewall:**
   - Is PostgreSQL port (5432) open voor externe connecties?
   - Zelfde voor Redis (6379)

2. **Check Database Whitelist:**
   - Sommige Coolify setups hebben IP whitelist
   - Voeg je lokale IP toe in Coolify

3. **Use SSH Tunnel (als firewall gesloten):**
   ```bash
   # SSH tunnel naar PostgreSQL
   ssh -L 5432:localhost:5432 user@hetzner-ip
   
   # In .env gebruik dan:
   DATABASE_URL="postgresql://partyquiz:password@localhost:5432/partyquiz_prod"
   ```

### Error: "Redis connection refused"

**Oplossing 1:** Check REDIS_URL format
```bash
# Correct formaat:
redis://host:6379
redis://:password@host:6379
```

**Oplossing 2:** Redis draait mogelijk op andere port
```bash
# Check in Coolify welke port Redis gebruikt
```

### Error: "Invalid NEXTAUTH_SECRET"

**Oplossing:**
```bash
# Moet minimaal 32 characters zijn
openssl rand -base64 32
```

### Error: "SMTP connection failed"

**Oplossing:**
```bash
# Controleer Ethereal credentials
# Host: smtp.ethereal.email
# Port: 587 (NIET 25 of 465)
# Username: je_ethereal_email@ethereal.email
# Password: je_ethereal_password
```

---

## 🎯 Nu Klaar Voor Testing!

Ga verder met **TESTING_GUIDE.md** om alle features te testen:

```bash
# Start bij Phase 1: Authentication
# Volg alle 12 test phases
# Check off elke test in de checklist
```

---

## 💡 Pro Tips

### Tip 1: Database Isolation

Als je wilt testen zonder productie data te raken:

```bash
# Maak aparte test database in Coolify
# Gebruik DATABASE_URL met test database
DATABASE_URL="postgresql://partyquiz:pass@db.coolify.io:5432/partyquiz_test"
```

### Tip 2: Redis Namespace

Voorkom conflict met productie Redis data:

```bash
# In apps/ws/src/config/redis.ts
const redis = new Redis({
  url: process.env.REDIS_URL,
  keyPrefix: 'dev:' // Alle keys krijgen 'dev:' prefix
})
```

### Tip 3: Hot Reload

Beide servers hebben hot reload:
- **Web app:** Auto-refresh bij code changes
- **WebSocket:** Auto-restart bij code changes

---

## 📊 Resource Usage

**Lokaal (development):**
- Web app: ~200MB RAM
- WebSocket: ~100MB RAM
- Node.js: ~50MB RAM

**Coolify (remote databases):**
- PostgreSQL: Bestaande resource (geen extra kosten)
- Redis: Bestaande resource (geen extra kosten)

**Totaal:** €0 extra voor lokaal testen (gebruik bestaande Coolify resources)

---

## 🚀 Next Steps

1. ✅ Complete lokale setup (deze guide)
2. 🧪 Execute **TESTING_GUIDE.md** (alle 12 phases)
3. 🐛 Fix any bugs gevonden tijdens testing
4. 🚀 Deploy naar productie (zie **DEPLOYMENT_ARCHITECTURE.md**)

**Geschatte tijd:**
- Setup: 15 minuten
- Testing: 2-3 uur (compleet)
- Bug fixes: 1-2 uur (indien nodig)
- **Total: ~4 uur tot production-ready** 🎉
