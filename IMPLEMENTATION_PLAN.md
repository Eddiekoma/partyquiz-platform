# PartyQuiz Platform - Implementatieplan

**Datum:** 6 februari 2026  
**Status:** Fase 1 & 2 Afgerond  
**Versie:** 1.1

---

## 📋 Voortgang Samenvatting

### ✅ Afgerond
- **Dashboard Dark Theme** - Alle pagina's geconverteerd naar Databridge360 donker thema
- **UI Components** - Card, Button, Input componenten naar dark mode
- **Invite Systeem** - Complete API + UI voor team uitnodigingen
- **Members Management** - Volledig werkende members pagina + API
- **Questions/Quizzes** - Dark theme voor alle vraag/quiz pagina's
- **NextAuth v5 Migratie** - Alle API routes bijgewerkt

### 🔄 In Uitvoering
- Live sessions testing op productie

### 📋 Te Doen
- Spotify integratie testen
- YouTube integratie voltooien
- Minigames (Swan Race) implementeren

---

## 📋 Inhoudsopgave

1. [Platform Overzicht](#1-platform-overzicht)
2. [Authenticatie Systeem](#2-authenticatie-systeem)
3. [Dashboard Styling](#3-dashboard-styling)
4. [Navigatie Structuur](#4-navigatie-structuur)
5. [Workspace & Team Management](#5-workspace--team-management)
6. [Integraties (Spotify/YouTube)](#6-integraties-spotifyyoutube)
7. [Games & Minigames](#7-games--minigames)
8. [Implementatie Volgorde](#8-implementatie-volgorde)

---

## 1. Platform Overzicht

### Wat is PartyQuiz?
Een SaaS platform voor het hosten van interactieve quiz-sessies met:
- **Multi-tenant workspaces** - Teams kunnen eigen workspaces hebben
- **Live sessies** - Real-time quiz hosting via WebSocket
- **Media integratie** - Spotify audio, YouTube video, eigen uploads
- **Minigames** - Swan Race en toekomstige games als afwisseling

### Technische Stack
| Component | Technologie |
|-----------|-------------|
| Frontend | Next.js 15 (App Router) |
| Backend API | Next.js API Routes |
| WebSocket | Socket.io (separate service) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth v4 (JWT sessions) |
| Cache | Redis (leaderboards, rate limiting) |
| Storage | Hetzner S3-compatible object storage |
| Deployment | Coolify + Cloudflare Tunnel |

### Huidige URLs
- **Productie:** https://partyquiz.databridge360.com
- **Player Join:** https://partyquiz.databridge360.com/join

---

## 2. Authenticatie Systeem

### ✅ Wat Werkt

#### 2.1 Inlogmethoden
1. **Email + Wachtwoord** (CredentialsProvider)
   - Registratie met wachtwoord
   - Email verificatie vereist
   - Wachtwoord hashing met bcrypt

2. **Google OAuth** (GoogleProvider)
   - One-click inloggen
   - Automatische email verificatie
   - Account linking met bestaande accounts (`allowDangerousEmailAccountLinking: true`)

3. **Magic Link** (EmailProvider - optioneel)
   - Inloggen via email link
   - Geen wachtwoord nodig
   - Vereist SMTP configuratie

#### 2.2 Session Management
```typescript
// JWT Strategy (niet database sessions)
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 dagen
}

// Cookie naam (HTTPS productie)
"__Secure-next-auth.session-token"
```

#### 2.3 Configuratie (Environment Variables)
```bash
# Required
NEXTAUTH_URL=https://partyquiz.databridge360.com
NEXTAUTH_SECRET=<random-string>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Optional: Email/Magic Link
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=user
EMAIL_SMTP_PASS=pass
EMAIL_FROM=noreply@example.com
```

### 📁 Relevante Bestanden
- `/apps/web/src/lib/auth.ts` - NextAuth configuratie
- `/apps/web/src/app/auth/signin/page.tsx` - Login pagina
- `/apps/web/src/app/auth/signup/page.tsx` - Registratie pagina
- `/apps/web/src/app/api/auth/[...nextauth]/route.ts` - Auth API routes

---

## 3. Dashboard Styling

### ❌ Probleem
Dashboard gebruikt witte achtergrond (`bg-gray-50`) terwijl rest van de app Databridge360 dark theme gebruikt.

### 🎨 Databridge360 Theme
```css
/* Gradient backgrounds */
--gradient-main: linear-gradient(135deg, #0F0A1E 0%, #1A1033 50%, #2D1B4E 100%);

/* Colors */
--primary: #8B5CF6;      /* Violet */
--secondary: #EC4899;    /* Pink */
--accent: #06B6D4;       /* Cyan */
--surface: rgba(255, 255, 255, 0.05);
--border: rgba(255, 255, 255, 0.1);

/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### ✅ Fix Afgerond

Dashboard en alle workspace pagina's zijn nu geconverteerd naar Databridge360 dark theme:
- `layout.tsx` - Dark gradient achtergrond
- `page.tsx` - Glassmorphism cards
- `workspaces/` - Alle workspace pagina's
- `questions/` - Question bank met dark theme
- `quizzes/` - Quiz pagina's met dark theme
- UI Components (`Card`, `Button`, `Input`) - Volledig dark mode

---

## 4. Navigatie Structuur

### ❌ Huidige Problemen

#### 4.1 Broken Links in DashboardNav
```tsx
// Deze routes bestaan NIET:
"/dashboard/questions"  // → 404
"/dashboard/quizzes"    // → 404
```

#### 4.2 Huidige Route Structuur
```
/dashboard              → Workspace overzicht
/dashboard/settings     → User settings
/(app)/workspaces/[id]  → Workspace detail
  └── /sessions         → Live sessions van workspace
```

### ✅ Gewenste Structuur
```
/dashboard                    → Overzicht alle workspaces + stats
  ├── /settings              → Account instellingen
  └── /invites               → Openstaande uitnodigingen

/(app)/workspaces/[id]       → Workspace home
  ├── /questions             → Vragen bank (in deze workspace)
  ├── /quizzes               → Quiz templates
  ├── /sessions              → Live sessies
  ├── /members               → Team leden + invites
  └── /settings              → Workspace instellingen
      └── /integrations      → Spotify/YouTube setup
```

### ✅ Fix Afgerond
1. ~~Update `DashboardNav.tsx` - verwijder broken links of redirect naar workspace-specifieke routes~~
2. ~~Voeg workspace selector toe bovenin~~
3. ~~Context-aware navigatie (dashboard vs workspace)~~

Dashboard navigatie toont nu alleen werkende links (Workspaces, Settings) en linkt correct naar workspace-specifieke pagina's.

---

## 5. Workspace & Team Management

### 📊 Database Models (Bestaand)

```prisma
model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  ownerId     String
  logoUrl     String?
  // ... branding fields
  
  owner       User              @relation("WorkspaceOwner", ...)
  members     WorkspaceMember[]
  invites     WorkspaceInvite[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        String   // OWNER, ADMIN, EDITOR, VIEWER
  joinedAt    DateTime @default(now())
  
  workspace   Workspace @relation(...)
  user        User      @relation(...)
  
  @@unique([workspaceId, userId])
}

model WorkspaceInvite {
  id          String    @id @default(cuid())
  workspaceId String
  email       String
  role        String
  token       String    @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  invitedById String
}
```

### 🔴 Ontbrekende Functionaliteit

### ✅ Invite Flow (AFGEROND)

| Stap | Status | API |
|------|--------|-----|
| Invite aanmaken | ✅ Werkt | `POST /api/workspaces/[id]/invites` |
| Invites bekijken (owner) | ✅ Werkt | `GET /api/workspaces/[id]/invites` |
| Invite accepteren | ✅ Werkt | `POST /api/invites/[token]` |
| Invite verwijderen | ✅ Werkt | `DELETE /api/workspaces/[id]/invites?token=xxx` |
| Mijn invites bekijken | ✅ Werkt | `GET /api/user/invites` |

### ✅ Members Management (AFGEROND)

| Stap | Status | API |
|------|--------|-----|
| Members bekijken | ✅ Werkt | `GET /api/workspaces/[id]/members` |
| Rol wijzigen | ✅ Werkt | `PATCH /api/workspaces/[id]/members/[userId]` |
| Lid verwijderen | ✅ Werkt | `DELETE /api/workspaces/[id]/members/[userId]` |

### ✅ UI Pages (AFGEROND)

1. **API Routes:**
   - `GET /api/workspaces/[id]/invites` - Lijst openstaande invites
   - `GET /api/workspaces/[id]/members` - Lijst members met rollen
   - `POST /api/invites/[token]/accept` - Accepteer invite
   - `GET /api/user/invites` - Mijn openstaande invites

2. **UI Pages:**
   - `/invites/[token]` - Invite acceptatie pagina
   - `/(app)/workspaces/[id]/members` - Members overzicht

---

## 6. Integraties (Spotify/YouTube)

### 🎵 Spotify Integratie

#### Huidige Situatie
Spotify tokens worden op **twee plekken** opgeslagen:

```prisma
// 1. User-level (legacy)
model User {
  spotifyAccessToken  String?
  spotifyRefreshToken String?
  spotifyTokenExpiry  DateTime?
}

// 2. Workspace-level (nieuw)
model SpotifyIntegration {
  workspaceId           String @unique
  encryptedRefreshToken String
  scopesJson            Json
}
```

#### Aanbevolen Aanpak: Hybride Model
```
┌─────────────────────────────────────────────────────────┐
│  User Level                                             │
│  - User koppelt eigen Spotify account                   │
│  - Tokens opgeslagen in User model                      │
│  - "Mijn Spotify" voor personal playlists               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Workspace Level                                        │
│  - Owner koppelt workspace aan hun Spotify              │
│  - Of: Aparte "team" Spotify account                    │
│  - Alle members kunnen workspace muziek gebruiken       │
│  - SpotifyIntegration model                             │
└─────────────────────────────────────────────────────────┘
```

#### Functionaliteit
- **Track zoeken** via Spotify Web API
- **30-sec previews** afspelen (gratis, geen Premium nodig)
- **Full tracks** vereist Spotify Premium op verbonden account

### 📺 YouTube Integratie

#### Huidige Situatie
- Geen OAuth authenticatie
- Publieke YouTube IFrame Embed API
- Ondersteunt `start` en `end` parameters voor fragmenten

#### YouTube Premium & Ads
> **Belangrijk:** YouTube IFrame API toont altijd advertenties tenzij:
> 1. De **video uploader** heeft monetization uitgeschakeld
> 2. Je embedded player niet in "monetized" mode staat

**YouTube Premium helpt NIET** voor embedded videos - Premium werkt alleen in de officiële YouTube app/website voor de ingelogde gebruiker.

#### Mogelijke Oplossingen voor Ads
1. **Gebruik korte fragmenten** (< 30 sec) - vaak geen ads
2. **Eigen video content** uploaden zonder monetization
3. **Audio-only** mode overwegen (geen video ads)
4. **Accepteren** dat ads onderdeel zijn van gratis YouTube

### ✅ Te Implementeren

1. **Spotify Workspace Settings UI**
   - `/workspaces/[id]/settings/integrations`
   - "Koppel Spotify" knop
   - Status indicator (gekoppeld/niet gekoppeld)

2. **YouTube** - Geen auth nodig, bestaande implementatie volstaat

---

## 7. Games & Minigames

### 🦢 Swan Race (Bestaand)

#### Wat is het?
Een canvas-gebaseerde race game waar spelers op hun telefoon tikken om hun "zwaan" vooruit te laten gaan.

#### Status: ✅ Geïmplementeerd

**Frontend Component:** `/apps/web/src/components/SwanRace.tsx`
```typescript
// Canvas game met:
// - Speler posities via WebSocket
// - Finish line detectie
// - Kleur per speler
// - Real-time updates
```

**Backend Logic:** `/apps/ws/src/index.ts`
```typescript
interface SwanRaceState {
  positions: Map<string, number>;  // playerId → position (0-100)
  finished: string[];              // playerIds die finish hebben bereikt
  startTime: number;
}

// Socket events:
socket.on("swan:tap", ...)         // Speler tikt
socket.emit("swan:positions", ...) // Broadcast posities
socket.emit("swan:finish", ...)    // Speler finisht
```

#### Database Support
```prisma
model QuizItem {
  itemType String @default("QUESTION") // QUESTION | MINIGAME | BREAK
  // ...
}
```

### 🔴 Ontbrekend

1. **Quiz Builder UI** voor minigames toevoegen
   - Dropdown: Vraag / Minigame / Pauze
   - Bij Minigame: selecteer game type (Swan Race, etc.)

2. **Minigame configuratie**
   - Duur instellen
   - Win condities

3. **Meer games** (toekomst)
   - Memory match
   - Quick draw
   - Trivia lightning round

---

## 8. Implementatie Volgorde

### Fase 1: Quick Fixes (30 min) 🚀
- [ ] Dashboard dark theme toepassen
- [ ] DashboardNav 404 links fixen/verwijderen
- [ ] Basic workspace-first navigatie

### Fase 2: Member & Invite Flow (2 uur)
- [ ] `GET /api/workspaces/[id]/invites` - Lijst invites
- [ ] `GET /api/workspaces/[id]/members` - Lijst members
- [ ] `POST /api/invites/[token]/accept` - Accept invite
- [ ] `/invites/[token]` - Accept invite pagina
- [ ] Members tab in workspace settings

### Fase 3: Integraties UI (1.5 uur)
- [ ] Workspace settings pagina structuur
- [ ] Spotify connect flow (hergebruik bestaande componenten)
- [ ] Integratie status indicatoren

### Fase 4: Quiz Builder Minigames (1 uur)
- [ ] QuizItem type selector in builder
- [ ] Swan Race als keuze optie
- [ ] Minigame preview/configuratie

### Fase 5: Polish & Deploy (30 min)
- [ ] Testen alle flows
- [ ] Commit & push
- [ ] Coolify deployment

---

## 📝 Notities

### YouTube Ads Conclusie
YouTube authenticatie zou geen verschil maken voor ads in embedded videos. De enige manier om ad-free te zijn is:
- Eigen content zonder monetization
- Of: Accepteren dat YouTube ads toont

### Spotify vs YouTube voor Audio
| Aspect | Spotify | YouTube |
|--------|---------|---------|
| Authenticatie | OAuth vereist | Niet nodig |
| Ads | Geen (via API) | Mogelijk |
| Audio kwaliteit | Hoog (320kbps) | Variabel |
| 30-sec previews | Gratis | N.v.t. |
| Full tracks | Premium nodig | Gratis |

**Aanbeveling:** Spotify voor muziekquiz (betere kwaliteit, geen ads), YouTube voor video content.

---

*Document laatst bijgewerkt: 6 februari 2026*
