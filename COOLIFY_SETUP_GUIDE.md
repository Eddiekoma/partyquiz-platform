# 🔧 Coolify Database Setup Guide

**Voor:** Lokaal testen met Coolify managed databases (PostgreSQL + Redis)

**Jouw setup:**
- ✅ Coolify v4.0.0-beta.462 op Hetzner VPS
- ✅ Cloudflare Tunnel voor toegang
- ✅ Managed PostgreSQL + Redis in Coolify

---

## 🎯 Doel

Database credentials ophalen uit Coolify en lokaal gebruiken voor development.

---

## 📋 Stap 1: Vind je Database in Coolify

### **1.1 Log in op Coolify**

Open je browser en ga naar je Coolify dashboard:
```
https://jouw-coolify-domein.com
```

### **1.2 Navigeer naar je Project**

1. Klik in de linker sidebar op **"Projects"**
2. Selecteer het project waar je PartyQuiz databases staan
3. Klik op de **Environment** (bijv. "Production")

### **1.3 Vind PostgreSQL Database**

1. In de environment, zie je alle resources
2. Zoek naar de **PostgreSQL** database
3. Klik erop om details te openen

---

## 🔑 Stap 2: PostgreSQL Connection String Ophalen

### **2.1 Connection Details**

In de PostgreSQL resource pagina:

1. Ga naar **"Connection Details"** tab (of "Configuration")
2. Je ziet iets als:

```
Internal Connection String:
postgresql://username:password@database-host:5432/database-name

External Connection String:
postgresql://username:password@external-ip:5432/database-name
```

### **2.2 Welke Connection String?**

**Voor lokaal testen (vanaf je Mac):**

✅ **Gebruik EXTERNAL connection string** (als beschikbaar)

**Formaat:**
```
postgresql://partyquiz:JE_WACHTWOORD@jouw-vps-ip:5432/partyquiz_prod
```

of via Cloudflare Tunnel:
```
postgresql://partyquiz:JE_WACHTWOORD@database.jouw-domein.com:5432/partyquiz_prod
```

### **2.3 Belangrijke Details Noteren**

Schrijf op (of kopieer):
- **Host:** `jouw-vps-ip` of `database.jouw-domein.com`
- **Port:** `5432` (standaard PostgreSQL)
- **Database:** `partyquiz_prod` (of andere naam)
- **Username:** `partyquiz`
- **Password:** `JE_WACHTWOORD`

---

## 🔴 Stap 3: Redis Connection String Ophalen

### **3.1 Vind Redis Resource**

1. Ga terug naar je environment
2. Zoek de **Redis** resource
3. Klik erop

### **3.2 Connection Details**

Je ziet:

```
Internal Connection String:
redis://redis-host:6379

or

redis://:password@redis-host:6379
```

**Externe toegang:**
```
redis://jouw-vps-ip:6379
```

of met wachtwoord:
```
redis://:JE_REDIS_PASSWORD@jouw-vps-ip:6379
```

### **3.3 Details Noteren**

- **Host:** `jouw-vps-ip` of `redis.jouw-domein.com`
- **Port:** `6379` (standaard Redis)
- **Password:** `JE_REDIS_PASSWORD` (als er een is)

---

## 🔒 Stap 4: Firewall/Network Check

### **4.1 Test PostgreSQL Bereikbaarheid**

Vanaf je Mac, test:

```bash
# Install nc (netcat) if needed
brew install netcat

# Test PostgreSQL port
nc -zv jouw-vps-ip 5432
```

**Verwachte output:**
```
Connection to jouw-vps-ip port 5432 [tcp/postgresql] succeeded!
```

**Als dit FAALT:**

#### **Optie A: Coolify Firewall**

In Coolify dashboard:
1. Ga naar je PostgreSQL resource
2. Check "Exposed Port" - staat deze open voor externe toegang?
3. Zo niet: Enable "Expose to Public" of configureer port forwarding

#### **Optie B: Hetzner VPS Firewall**

SSH naar je VPS:
```bash
ssh root@jouw-vps-ip
```

Check firewall:
```bash
sudo ufw status
```

Open PostgreSQL port:
```bash
sudo ufw allow 5432/tcp
sudo ufw reload
```

#### **Optie C: Cloudflare Tunnel Configuration**

Als je Cloudflare Tunnel gebruikt:
- Database poorten worden vaak NIET automatisch ge-tunneled
- Je moet misschien SSH tunnel gebruiken (zie hieronder)

### **4.2 Test Redis Bereikbaarheid**

```bash
nc -zv jouw-vps-ip 6379
```

Zelfde troubleshooting als PostgreSQL.

---

## 🚇 Alternatief: SSH Tunnel (Als Firewall Gesloten)

**Als je niet de database ports kunt/wilt openen:**

### **SSH Tunnel voor PostgreSQL**

Terminal 1:
```bash
# SSH tunnel: localhost:5432 → VPS:5432
ssh -L 5432:localhost:5432 root@jouw-vps-ip -N
```

Dan in `.env`:
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/database"
```

### **SSH Tunnel voor Redis**

Terminal 2:
```bash
# SSH tunnel: localhost:6379 → VPS:6379
ssh -L 6379:localhost:6379 root@jouw-vps-ip -N
```

Dan in `.env`:
```bash
REDIS_URL="redis://localhost:6379"
```

**Voordeel:**
- ✅ Veilig (via SSH)
- ✅ Geen firewall aanpassingen nodig
- ✅ Werkt altijd

**Nadeel:**
- ❌ Moet 2 terminals open houden
- ❌ Tunnels moeten draaien tijdens development

---

## 📝 Stap 5: Maak .env Bestand

Nu je alle credentials hebt, maak `.env`:

```bash
cd /Users/edwin/Documents/Databridge360/Partyquiz-Platform
cp .env.example .env
```

**Edit `.env` met je credentials:**

```bash
# ============================================
# DATABASE (Coolify PostgreSQL)
# ============================================
DATABASE_URL="postgresql://partyquiz:JE_WACHTWOORD@jouw-vps-ip:5432/partyquiz_prod"

# ============================================
# REDIS (Coolify Redis)
# ============================================
REDIS_URL="redis://jouw-vps-ip:6379"
# Of met wachtwoord:
# REDIS_URL="redis://:JE_REDIS_PASSWORD@jouw-vps-ip:6379"

# ============================================
# NEXTAUTH
# ============================================
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""  # ← Genereer hieronder

# ============================================
# EMAIL (Ethereal Test SMTP)
# ============================================
EMAIL_FROM="test@partyquiz.com"
EMAIL_SERVER_HOST="smtp.ethereal.email"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER=""  # ← Haal op van ethereal.email
EMAIL_SERVER_PASSWORD=""  # ← Haal op van ethereal.email

# ============================================
# SPOTIFY (Optioneel)
# ============================================
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""
SPOTIFY_REDIRECT_URI="http://localhost:3000/api/spotify/callback"

# ============================================
# YOUTUBE (Optioneel)
# ============================================
YOUTUBE_API_KEY=""

# ============================================
# HETZNER S3 (Optioneel)
# ============================================
S3_ENDPOINT="https://fsn1.your-objectstorage.com"
S3_BUCKET_NAME="partyquiz"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_REGION="eu-central-1"
```

---

## 🔐 Stap 6: Genereer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

**Output (bijvoorbeeld):**
```
K8fJ2mN9pQ4rS7tV1wX3yZ5aB8cD0eF2
```

Plak dit in `.env` bij `NEXTAUTH_SECRET=`:
```bash
NEXTAUTH_SECRET="K8fJ2mN9pQ4rS7tV1wX3yZ5aB8cD0eF2"
```

---

## 📧 Stap 7: Setup Ethereal Email (Gratis Test SMTP)

Voor magic link testing:

### **7.1 Maak Ethereal Account**

1. Ga naar: https://ethereal.email/create
2. Klik "Create Ethereal Account"
3. Je krijgt:
   ```
   Host: smtp.ethereal.email
   Port: 587
   Username: your.name@ethereal.email
   Password: your_password
   ```

### **7.2 Toevoegen aan .env**

```bash
EMAIL_SERVER_USER="your.name@ethereal.email"
EMAIL_SERVER_PASSWORD="your_password"
```

### **7.3 Emails Bekijken**

- Ga naar: https://ethereal.email/messages
- Login met je Ethereal account
- Alle "verzonden" magic links verschijnen hier

---

## ✅ Stap 8: Test Database Connectie

```bash
cd apps/web

# Test connectie
pnpm prisma db pull
```

**Success:**
```
✔ Introspected 23 models and wrote them into prisma/schema.prisma
```

**Error:**
```
Error: Can't reach database server at `jouw-vps-ip:5432`
```

→ Ga terug naar Stap 4 (Firewall/Network Check)

---

## 🚀 Stap 9: Run Migrations (Als Database Leeg)

**Alleen als database nog geen schema heeft:**

```bash
pnpm prisma migrate deploy
```

**Als database al schema heeft:**

```bash
pnpm prisma db push
```

---

## 🌱 Stap 10: Seed Test Data

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

## 🎯 Stap 11: Start Development Servers

### **Terminal 1 - Web App**

```bash
cd apps/web
pnpm dev
```

**Output:**
```
  ▲ Next.js 14.x
  - Local:        http://localhost:3000

✓ Ready in 2.3s
```

### **Terminal 2 - WebSocket Server**

```bash
cd apps/ws
pnpm dev
```

**Output:**
```
[WebSocket] Server running on http://localhost:3001
[WebSocket] Redis connected
[WebSocket] Game loop started (60 FPS)
```

---

## 🧪 Stap 12: Test de Setup

### **Test 1: Open Web App**

Browser → http://localhost:3000

✅ Zie homepage

### **Test 2: Sign In**

1. Klik "Sign In"
2. Vul email in: `test@example.com`
3. Klik "Send Magic Link"
4. ✅ Zie "Check your email"

### **Test 3: Magic Link**

1. Ga naar https://ethereal.email/messages
2. ✅ Zie email "Sign in to PartyQuiz Platform"
3. Klik magic link
4. ✅ Redirect naar dashboard

### **Test 4: Database Write**

1. In dashboard, klik "Create Workspace"
2. Naam: "Test Workspace"
3. Create
4. ✅ Werkruimte aangemaakt (data in Coolify database!)

---

## 🐛 Troubleshooting

### **Error: "Can't reach database server"**

**Check:**
1. Is DATABASE_URL correct in .env?
2. Draait PostgreSQL op Coolify?
3. Is port 5432 open in firewall?
4. Gebruik SSH tunnel (zie Stap 4)

### **Error: "Redis connection refused"**

**Check:**
1. Is REDIS_URL correct in .env?
2. Draait Redis op Coolify?
3. Is port 6379 open?
4. Wachtwoord correct (als er een is)?

### **Error: "Invalid NEXTAUTH_SECRET"**

```bash
# Regenerate
openssl rand -base64 32
```

Moet minimaal 32 characters zijn.

### **Error: "SMTP connection failed"**

**Check:**
- Port 587 (NIET 25 of 465)
- smtp.ethereal.email (correct spelling)
- Username is volledige email
- Password correct

---

## 🎉 Success Criteria

Alles werkt als:

- [x] `pnpm prisma db pull` succesvol
- [x] Web app draait op localhost:3000
- [x] WebSocket draait op localhost:3001
- [x] Magic link email ontvangen (Ethereal)
- [x] Sign in werkt → dashboard
- [x] Workspace create werkt (database write)
- [x] Redis connectie succesvol (check WebSocket logs)

---

## 📊 Samenvatting van Wat Je Hebt Opgezet

```
┌─────────────────────┐         Internet        ┌──────────────────┐
│  Je Mac (lokaal)    │ ◄───────────────────► │ Coolify (Hetzner)│
│                     │                         │                  │
│ • localhost:3000    │    DATABASE_URL         │ • PostgreSQL     │
│ • localhost:3001    │ ──────────────────────► │ • Redis          │
│                     │    REDIS_URL            │                  │
└─────────────────────┘                         └──────────────────┘
```

---

## 🚀 Volgende Stappen

Nu je lokaal kunt testen:

1. ✅ **Volg TESTING_GUIDE.md** - Test alle 12 phases
2. 🐛 **Fix bugs** gevonden tijdens testing
3. 🚀 **Deploy naar productie** via Coolify

---

## 💡 Extra Tips

### **Tip 1: Keep SSH Tunnels Alive**

Als je SSH tunnels gebruikt, maak alias:

```bash
# In ~/.zshrc
alias pq-tunnel='ssh -L 5432:localhost:5432 -L 6379:localhost:6379 root@jouw-vps-ip -N'
```

Dan:
```bash
pq-tunnel  # Start beide tunnels
```

### **Tip 2: Productie vs Development Database**

Als je wilt voorkomen dat je productie data raakt:

1. Maak aparte "development" database in Coolify
2. Gebruik die connection string in .env

### **Tip 3: Environment Switcher**

Maak 2 env bestanden:

```bash
.env.local    # Lokale/test databases
.env.coolify  # Coolify managed databases
```

Switch:
```bash
cp .env.coolify .env  # Gebruik Coolify
```

---

**Klaar om te beginnen?** 🚀

Laat me weten welke stap je eerst wilt doen!
