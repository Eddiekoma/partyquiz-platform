# PARTYQUIZ PLATFORM — ULTRA MASTER SPEC & EXECUTION PROMPT

⚠️ **BELANGRIJK**  
Dit document is bedoeld als **enige en volledige context** voor **Claude Sonnet 4.5** in VS Code.

**Doel:** Volledige realisatie, afwerking en **productie-deployment**

Claude moet hiermee:
- zelfstandig architectuur- en designkeuzes maken (met onderbouwing)
- waar nodig internetbronnen raadplegen (Spotify, YouTube, Hetzner, Coolify, Cloudflare)
- vervolgonderzoek uitvoeren via agents
- het volledige platform implementeren (frontend, backend, realtime, games)
- alles testen
- en **production-ready deployen via Coolify op Hetzner**
- eindigen met een werkende applicatie op:
  👉 **https://partyquiz-platform.databridge360.com**

Claude mag **NIET stoppen** voordat:
- alle acceptatiecriteria zijn gehaald
- deployment werkt
- documentatie compleet is

> Projectnaam (werknaam): **Quizzly / SwanRun / PartyQuiz**  
> Kern: **Workspaces + samenwerking + vraagbank + quiz builder + live play + muziek + YouTube + minigames (incl. Zwanen Race)**

---

## 0) INFRASTRUCTUUR — HUIDIGE SITUATIE (FEITELIJK & VAST)

### Hosting & CI/CD
- **Server**: Hetzner VPS
- **Orchestratie**: Coolify
- **Source control**: GitHub
- **CI/CD-flow**:
  - GitHub repository is gekoppeld aan Coolify
  - Elke push naar branch `main` → automatische deployment

### Networking & DNS
- **Cloudflare Tunnel** wordt gebruikt
- Geen publieke poorten open op Hetzner
- TLS termination via Cloudflare
- Domein:
  - Hoofddomein: `databridge360.com`
  - Subdomein (nieuw):
    👉 `partyquiz-platform.databridge360.com`
- DNS:
  - Cloudflare-managed (proxy **ON**)
  - Tunnel route naar Coolify service
- Interne poorten (bijv. 3000/8080) zijn **alleen intern**

❗ Claude mag **GEEN klassieke Nginx/poort-forwarding aannames** doen  
❗ Alles loopt via **Coolify + Cloudflare Tunnel**

---

## 1) IMPLEMENTATION CONSTRAINTS (MUST FOLLOW)

### 1.1 Routing & WebSockets
**DECISION: Single domain + path-based routing**
- Web app: `https://partyquiz-platform.databridge360.com`
- WebSocket: `wss://partyquiz-platform.databridge360.com/ws`
- **Rationale**: Eenvoudiger DNS, één Cloudflare Tunnel route, geen CORS issues
- Implementation:
  - Next.js app op poort 3000 (intern)
  - WebSocket server op poort 8080 (intern)
  - Cloudflare Tunnel route met path-based routing naar juiste service
  - Alternatief: WebSocket server als custom Next.js server (zelfde process)

### 1.2 Authentication
**DECISION: Magic link (passwordless) via Auth.js (NextAuth v5)**
- Library: **Auth.js** (next-auth@beta voor App Router)
- Provider: Email (magic link)
- Requirements:
  - HTTPS-aware redirects (Cloudflare Tunnel compatible)
  - Secure session cookies (httpOnly, secure, sameSite)
  - Rate limiting op email verzending (max 3/5min per email)
- Database sessions (Prisma adapter)
- Optional later: OAuth providers (Google, etc.)

### 1.3 Media & Storage Model
**DECISION: Extensible provider-based media model**
```prisma
model QuestionMedia {
  id          String   @id
  questionId  String
  provider    String   // "UPLOAD", "SPOTIFY", "YOUTUBE"
  mediaType   String   // "IMAGE", "AUDIO", "VIDEO"
  reference   Json     // Flexible: {trackId, videoId, storageKey, etc.}
  metadata    Json?    // {startMs, durationMs, title, etc.}
  order       Int
}
```
- **Rationale**: Makkelijk uitbreiden met nieuwe providers zonder schema changes
- Spotify refs: `{provider: "SPOTIFY", reference: {trackId: "...", startMs: 0, durationMs: 30000}}`
- YouTube refs: `{provider: "YOUTUBE", reference: {videoId: "...", startSeconds: 10, endSeconds: 40}}`

### 1.4 Game Server (Swan Race)
**DECISION: Server-authoritative netcode**
- **Clients NEVER send positions**
- Clients only send: input (tilt/joystick direction + throttle)
- Server calculates: positions, collisions, power-ups, scoring
- Server broadcasts: game state (20Hz tick rate)
- Client prediction: minimal (visual smoothing only)
- **Rationale**: Prevents cheating, ensures fair gameplay

### 1.5 YouTube Compliance
- **Embed only** (IFrame Player API)
- No download, no re-hosting
- Respect YouTube Terms of Service
- CORS-aware embed configuratie

---

## 2) Non-negotiables / harde eisen
- **Iedereen kan een workspace aanmaken**.
- **Workspace Owner heeft hoogste rechten**.
- **Samenwerken**: meerdere Editors/Admins kunnen tegelijk vragen bouwen en quizzen samenstellen.
- **Centrale vraagbank per workspace**: vragen bestaan als first-class objects, herbruikbaar in meerdere quizzen.
- **Media first**: foto's upload, Spotify tracks, YouTube video's — en daar vragen / rondes van maken.
- **Live game mode**: QR join, realtime scoring, host screen, player screen.
- **Minigame**: **Zwanen Race** is verplicht en geïntegreerd in de flow.
- **Professioneel**: security, logging, migrations, tests, CI/CD, deployment, back-ups, rate limits, GDPR basics.

---

## 3) Productoverzicht (wat bouwen we)

### 3.1 Modules

1) **Auth & Accounts**
   - User accounts (email-based)
   - Workspace creation
   - Invite system

2) **Workspaces**
   - Members + roles
   - Workspace settings + branding (naam, logo, kleuren, optioneel)
   - Audit log

3) **Question Bank (Editor)**
   - Vraagtypes (zie 2.2)
   - Media library (images, spotify refs, youtube refs)
   - Tagging, search, filters
   - Comments / review notes
   - Versioning light (edit history)

4) **Quiz Builder**
   - Quiz templates
   - Rondes
   - Drag & drop order
   - Per item instellingen (timer, punten, reveal)
   - Preview mode
   - Publish → Live Session

5) **Live Session (Host/Player)**
   - Host screen: lobby, QR, vraag, timer, leaderboard, reveal
   - Player screen: join, naam/avatar, antwoorden, feedback
   - Realtime state via WebSockets
   - Anti-cheat basics (rate limit, answer lock)

6) **Music & Video**
   - Spotify: track/playlist selection + start/duration
   - “Hitster”-achtige minigame: titel/artiest/jaar raden
   - YouTube: embed + start/end segment + vragen hierover

7) **Minigames**
   - **Swan Race** (bootjes vluchten voor zwanen)
   - Plugin-achtige game interface zodat later uitbreiden makkelijk is

8) **Admin/Operations**
   - Monitoring/logging
   - Backups
   - One-click deploy via Coolify

---

## 4) Functionele details

### 4.1 Workspace & samenwerking
**Workspace**
- heeft eigen: members, roles, question bank, media, quizzes, sessions, audit log.
- multi-tenant: strict data isolation op workspace_id.

**Invites**
- owner/admin kan leden uitnodigen per email + rol.
- invite link met token (expires).

**Samenwerken**
- "Presence" indicator (optioneel): wie is online/in welke quiz.
- "Soft lock" op edits: als editor een vraag aanpast → UI toont "X is aan het bewerken".
- Comment threads op questions/quiz items (intern).

### 4.2 Vraagtypes (Question Types)
Alle vragen worden opgeslagen als `Question` met subtype. Minimale set:

**A) Standard**
- `MCQ` (meerkeuze: 2-6 opties, correct antwoord(en))
- `TRUE_FALSE`
- `OPEN` (open tekst; host kan markeren of auto-check op keywords)
- `ORDERING` (zet items in juiste volgorde)

**B) Photo-based**
- `PHOTO_GUESS` (1-5 images; vraag + antwoord)
- `PHOTO_ZOOM_REVEAL` (start zoomed-in; reveal)
- `PHOTO_TIMELINE` (meerdere foto’s sorteren op jaar/periode)

**C) Music-based (Spotify refs)**
- `MUSIC_GUESS_TITLE`
- `MUSIC_GUESS_ARTIST`
- `MUSIC_GUESS_YEAR` (slider + punten op afstand)
- `MUSIC_HITSTER_TIMELINE` (tracks in juiste volgorde slepen)
- `MUSIC_OLDER_NEWER_THAN` (binary; fun)

**D) Video-based (YouTube)**
- `YOUTUBE_SCENE_QUESTION` (clip segment + vraag)
- `YOUTUBE_NEXT_LINE` (quote/scene raden)
- `YOUTUBE_WHO_SAID_IT`

**E) Social / Party**
- `POLL` (“Wie is het meest…?”)
- `EMOJI_VOTE` (reacties; leaderboard bonus)
- `CHAOS_EVENT` (random effect: dubbele punten, swap scores, etc. — optioneel en configureerbaar)

### 4.3 Quiz Builder (opbouw)
**Quiz**
- `Quiz` is een blueprint (samenstelbare structuur).
- `QuizVersion` optioneel (later).
- `QuizItem` = verwijzing naar question of minigame of break/music.

**Rondes**
- round types: `QUIZ_ROUND`, `MUSIC_ROUND`, `VIDEO_ROUND`, `MINIGAME`, `BREAK`
- per ronde: puntenregels, timer defaults, theme music.

**Volgorde**
- drag & drop (UI)
- backend bewaart `position` integer (sparse ordering of fractional ordering).

### 4.4 Live Session
**Session**
- gestart vanuit published quiz.
- session code (kort) + QR join url.
- state machine:
  - LOBBY → ITEM_INTRO → ITEM_ACTIVE → ITEM_LOCKED → REVEAL → LEADERBOARD → NEXT_ITEM → END
- Host controls: start, next, pause, force reveal, kick player.

**Players**
- join met naam + avatar (geen account nodig).
- anti-spam: per device/session token + rate limiting.
- optional: teams (later)

**Scoring**
- per question: base points + speed bonus
- per minigame: score mapping function (normalized)
- leaderboard realtime

---

## 5) ZWANEN RACE (Minigame spec)
### 3.1 Concept
Iedere speler bestuurt een bootje in top-down 2D. Zwanen zijn vijanden die chasen. Doel: zo lang mogelijk overleven en/of checkpoints verzamelen.

### 3.2 Controls
- Primair: **Gyro tilt** (iOS/Android)
- Fallback: on-screen joystick
- Haptics/vibration bij “zwaan dichtbij” (optioneel)

### 3.3 Gameplay
- Arena met water + obstakels (boeien).
- Zwanen spawnen met toenemende difficulty.
- Power-ups:
  - `FISH_LURE` (zwaan afleiden)
  - `TURBO`
  - `SHIELD`
- Score:
  - tijd overleefd (basis)
  - powerups collected (bonus)
  - near-miss (bonus)
- Resultaat → terug naar main leaderboard.

### 3.4 Integratie
- Minigame is een `QuizItem` type: `MINIGAME_SWAN_RACE`.
- Start/stop door host.
- Game server beheert authoritative state; clients sturen input.

### 3.5 Tech aanpak
- Render: HTML5 Canvas (of PixiJS) in browser.
- Physics light: custom/simple.
- Netcode:
  - Server tick (20-30Hz)
  - Client prediction minimal (optioneel)
  - Inputs: throttle + steering.

---

## 6) Tech stack (aanbevolen, production-ready)
### 4.1 Frontend
- **Next.js (App Router)** voor Admin/Editor/Host/Player UI
- Styling: TailwindCSS
- State: Zustand of Redux Toolkit (light)
- Forms: React Hook Form + Zod
- Drag & drop: dnd-kit
- Charts/leaderboard animations: framer-motion (optioneel)

### 4.2 Backend
Kies 1 van 2 opties:

**Optie A (aanbevolen): “Modular monolith”**
- Next.js server + separate WebSocket server (Node)
- REST/JSON + WebSockets (socket.io)
- Prisma ORM

**Optie B: Full separation**
- API service (NestJS/Fastify) + WebSocket service + Next frontend

👉 Start met Optie A, maar structureer code alsof later splitten kan.

### 4.3 Database & infra
- Postgres
- Redis (session state + rate limit + presence)
- Object storage: **Hetzner Object Storage (S3-compatible)**
- Email: Postmark/Mailgun/SMTP

---

## 7) Spotify & YouTube integratie (must)
### 5.1 Spotify OAuth
Spotify vereist moderne OAuth aanpak. Gebruik **Authorization Code Flow met PKCE** voor client-side scenarios en veilige redirects. (Spotify heeft implicit grant uitgefaseerd en eist PKCE/HTTPS redirects.)  
Bronnen:
- https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

**Implementatie**
- Alleen host/admin hoeft Spotify te koppelen (workspace-level integration).
- Opslaan in DB: refresh token encrypted, access token transient.
- Mogelijkheid: per workspace meerdere “music providers” (future).

**Functionaliteit**
- Track search & select (Spotify Web API)
- Track refs opslaan: `spotify_track_id`, `start_ms`, `duration_ms`
- Playback:
  - Simpel: “Open in Spotify” + host bedient handmatig
  - Pro: Spotify Web Playback SDK (alleen als haalbaar + accounts) — optioneel

### 5.2 YouTube embed
Gebruik YouTube IFrame Player API met start/end segmenten.
Bronnen:
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/player_parameters

**Implementatie**
- Store: `youtube_video_id`, `start_seconds`, `end_seconds`
- Host screen kan clip afspelen + automatisch stoppen op `end_seconds`.

---

## 8) Object Storage & uploads (Hetzner)
Hetzner Object Storage is S3-compatible; configureer **CORS** zodat browser direct kan uploaden met presigned URLs.
Bronnen:
- https://docs.hetzner.com/storage/object-storage/howto-protect-objects/cors/
- https://docs.hetzner.com/storage/object-storage/getting-started/using-s3-api-tools/
- https://docs.hetzner.com/storage/object-storage/overview/

**Upload flow**
1) Client vraagt `POST /api/uploads/presign` met metadata.
2) Server genereert presigned PUT URL (AWS SDK S3 client configured for Hetzner endpoint).
3) Client upload direct naar bucket.
4) Server slaat Asset record op.
5) Serving:
   - Private bucket + signed GET, of
   - Public bucket (niet aanbevolen voor privéfoto’s) + random keys.

**Security**
- file type validation
- size limits
- virus scan (optioneel later)

---

## 9) Permissions model (RBAC)
### 7.1 Rollen
- OWNER
- ADMIN
- EDITOR
- CONTRIBUTOR
- VIEWER

### 7.2 Matrix (minimum)
**Workspace**
- OWNER: manage workspace, billing (future), delete
- ADMIN: manage members, publish quiz, start sessions
- EDITOR: create/edit questions, create/edit quizzes
- CONTRIBUTOR: create questions + upload media (no publish)
- VIEWER: read-only

**Live session**
- HOST (derived permission): ADMIN or OWNER, optionally EDITOR if enabled.

---

## 10) Data model (Prisma-style outline)

> Claude: concretiseer dit naar Prisma schema + migrations.
> **IMPORTANT**: Gebruik extensible media model zoals gedefinieerd in sectie 1.3

### Entities

**Core**
- User(id, email, name, createdAt)
- Workspace(id, name, slug, ownerId, brandingJson, createdAt)
- WorkspaceMember(id, workspaceId, userId, role, createdAt)
- WorkspaceInvite(id, workspaceId, email, role, token, expiresAt, createdAt)

**Media & Storage**
- Asset(id, workspaceId, type:image|audio|other, storageKey, mime, size, width, height, duration, createdBy, createdAt)
- SpotifyIntegration(id, workspaceId, encryptedRefreshToken, scopesJson, createdAt, updatedAt)

**Questions (extensible media model)**
- Question(id, workspaceId, type, title, prompt, explanation, difficulty, tagsJson, createdBy, updatedBy, status, createdAt, updatedAt)
- QuestionOption(id, questionId, text, isCorrect, order)
- **QuestionMedia**(id, questionId, provider:UPLOAD|SPOTIFY|YOUTUBE, mediaType:IMAGE|AUDIO|VIDEO, reference:Json, metadata:Json?, order)
  - **provider**: "UPLOAD" (Asset), "SPOTIFY" (track), "YOUTUBE" (video)
  - **reference**: Flexible JSON
    - Upload: `{assetId: "..."}`
    - Spotify: `{trackId: "...", startMs: 0, durationMs: 30000}`
    - YouTube: `{videoId: "...", startSeconds: 10, endSeconds: 40}`
  - **metadata**: Optional JSON voor title cache, etc.

**Quiz**
- Quiz(id, workspaceId, title, description, createdBy, updatedAt)
- QuizRound(id, quizId, title, order, defaultsJson)
- QuizItem(id, quizRoundId, order, itemType:QUESTION|MINIGAME|BREAK, questionId?, minigameType?, settingsJson)

**Live Session**
- LiveSession(id, workspaceId, quizId, code, status, hostUserId, startedAt, endedAt)
- LivePlayer(id, sessionId, name, avatar, deviceIdHash, joinedAt, leftAt)
- LiveAnswer(id, sessionId, playerId, quizItemId, payloadJson, isCorrect, score, answeredAt)

**Audit**
- AuditLog(id, workspaceId, actorUserId, action, entityType, entityId, payloadJson, createdAt)

---

## 11) UX / Design system (professional)
### 9.1 Design goals
- “Feest-proof”: grote knoppen, high contrast, snel, weinig tekst.
- Host screen: beamer-friendly, large typography.
- Mobile: one-hand friendly.

### 9.2 UI structuur
- **Landing**
- **Auth**
- **Workspace switcher**
- **Question Bank**
- **Question Editor**
- **Media Library**
- **Quiz Builder**
- **Quiz Preview**
- **Sessions**
  - Host screen
  - Player join/answer UI

### 9.3 UX details
- Autosave in editor
- Undo (minimaal: confirmation + history)
- Inline validations
- Fast search (debounced)

---

## 12) Deployment (Coolify op Hetzner + Cloudflare Tunnel)

### Architectuur overzicht
Coolify ondersteunt Next.js deployments (nixpacks of Dockerfile).
Bronnen:
- https://coolify.io/docs/applications/nextjs
- https://www.digitalocean.com/community/tutorials/deploy-application-coolify

### Services in Coolify
- `app-web` (Next.js)
- `app-ws` (WebSocket server) — kan ook in same repo als aparte service
- `db-postgres` (managed via Coolify resource)
- `redis` (Coolify resource)
- (optioneel) `adminer` of `pgweb` (internal only)

### Cloudflare Tunnel configuratie (CRUCIAAL)

❗ **BELANGRIJKE DEPLOYMENT VEREISTEN**

Claude moet:

1. **Tunnel koppeling aan Coolify service**
   - Coolify services draaien op interne poorten (bijv. 3000, 8080)
   - Cloudflare Tunnel wordt geconfigureerd om verkeer naar deze poorten te routeren
   - GEEN publieke poorten nodig op Hetzner server

2. **DNS configuratie**
   - Domein: `partyquiz-platform.databridge360.com`
   - Cloudflare DNS record (proxy ON)
   - Tunnel route naar Coolify service

3. **TLS/HTTPS**
   - TLS termination gebeurt via Cloudflare
   - Interne communicatie kan HTTP zijn (tussen Tunnel en Coolify)
   - Cookies en redirects moeten HTTPS-aware zijn

4. **Health checks**
   - Implementeer `/healthz` endpoints voor web en ws services
   - Cloudflare/Coolify kunnen deze gebruiken voor monitoring

5. **WebSocket ondersteuning**
   - Cloudflare Tunnel ondersteunt WebSockets
   - Zorg voor correcte upgrade headers
   - Aparte service voor WebSockets of same-port met path routing

### Env vars (voorbeeld)
- `DATABASE_URL`
- `REDIS_URL`
- `NEXTAUTH_SECRET` (of custom auth secret)
- `APP_BASE_URL=https://partyquiz-platform.databridge360.com`
- `WS_BASE_URL=wss://partyquiz-platform.databridge360.com/ws` (of apart subdomein)
- S3 configuratie:
  - `S3_ENDPOINT` (Hetzner Object Storage endpoint)
  - `S3_REGION`
  - `S3_BUCKET`
  - `S3_ACCESS_KEY`
  - `S3_SECRET_KEY`
- Spotify:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REDIRECT_URI=https://partyquiz-platform.databridge360.com/api/auth/spotify/callback`
- Email:
  - `EMAIL_SMTP_*`
  - `EMAIL_FROM`
- `NODE_ENV=production`

### CI/CD flow
- GitHub repository gekoppeld aan Coolify
- Push naar `main` branch → automatische deployment
- Coolify rebuild + restart services
- Migrations draaien automatisch bij deploy
- Optioneel: staging + production environments (aanbevolen)

### Deployment checklist
1. ✅ Coolify resources aangemaakt (Postgres, Redis)
2. ✅ GitHub repo gekoppeld aan Coolify project
3. ✅ Environment variables geconfigureerd
4. ✅ Cloudflare Tunnel route ingesteld
5. ✅ DNS record aangemaakt (`partyquiz-platform.databridge360.com`)
6. ✅ Health checks werkend (`/healthz`)
7. ✅ Migrations succesvol uitgevoerd
8. ✅ Seed data optioneel ingeladen
9. ✅ HTTPS werkt via Cloudflare
10. ✅ WebSocket connectie test succesvol

### Backups
- Postgres daily dump (Coolify cron job of external backup solution)
- Object storage lifecycle rules (optioneel)
- Audit logs retention policy

---

## 13) Security & compliance (minimum)
- Passwordless magic link of email+password (magic link aanbevolen)
- CSRF protection (indien relevant)
- Secure cookies, https only
- Encrypt refresh tokens in DB (envelope encryption)
- Rate limiting endpoints (login, join, answers)
- Audit log for admin actions
- Privacy: emails nooit op host screen; "submitted by" opt-in.

---

## 14) Observability
- Structured logging (pino)
- Error tracking (Sentry optional)
- Health checks:
  - /healthz for web
  - /healthz for ws
- Metrics optional (Prometheus later)

---

## 15) "Definition of Done" (professional finish)

Claude moet opleveren:

1) **Werkende app op productie-URL**
   - Toegankelijk via: `https://partyquiz-platform.databridge360.com`
   - Cloudflare Tunnel correct geconfigureerd
   - HTTPS/TLS werkend
   - WebSockets functioneel

2) **Repository & code**
   - Werkende app in repo met README
   - Prisma schema + migrations
   - Seed scripts (demo workspace + demo questions)
   - Unit tests + minimal e2e (Playwright)

3) **Deployment & infrastructuur**
   - Dockerfiles of nixpacks config geschikt voor Coolify
   - Deploy guide (COOLIFY_DEPLOY.md met stap-voor-stap inclusief Cloudflare Tunnel setup)
   - Health checks werkend
   - Environment variables gedocumenteerd

4) **Functionaliteit compleet**
   - Zwanen Race v1 geïntegreerd in live session
   - Spotify PKCE integratie + music question types
   - YouTube embed question type met start/end segment
   - Admin/editor UX: question bank + quiz builder + live host

5) **Documentatie**
   - README.md (setup + architectuur overzicht)
   - COOLIFY_DEPLOY.md (deployment stappen + Cloudflare Tunnel configuratie)
   - DECISIONS.md (research output + architecturale keuzes)
   - SEED.md (demo data uitleg)
   - TESTING.md (test strategie + hoe te runnen)

**Claude stopt PAS wanneer:**
- ✅ App succesvol draait op `https://partyquiz-platform.databridge360.com`
- ✅ Alle acceptatiecriteria (sectie 16) zijn gehaald
- ✅ Deployment stabiel is (health checks groen)
- ✅ Documentatie compleet is

---

## 16) MEGA TASKLIST (Claude: voer dit uit als projectplan + uitvoering)

## EPIC A — Repo & foundation
A1. Init monorepo (pnpm) met apps:
- apps/web (Next.js)
- apps/ws (Node + socket.io)
- packages/shared (types, zod schemas)
A2. Configure lint/format (eslint, prettier), TS strict.
A3. Setup env handling (zod env validation).
A4. Setup DB (Postgres) + Prisma.
A5. Setup Redis client.
A6. Setup storage client (S3 SDK configured for Hetzner endpoint).

## EPIC B — Auth
B1. Implement auth (magic link preferred).
B2. Session management (JWT/cookies).
B3. User profile basics.
B4. Security hardening (rate limit login).

## EPIC C — Workspaces & RBAC
C1. Workspace CRUD (create/list/switch).
C2. Workspace slug & routing.
C3. Membership + role enforcement middleware.
C4. Invites (create, accept).
C5. Audit log baseline (workspace events).

## EPIC D — Media library
D1. Asset schema + API.
D2. Presigned upload endpoint + client uploader.
D3. CORS docs note + validation.
D4. Media browser UI (grid/list) + search.
D5. Permissions: contributor upload, editor reuse.

## EPIC E — Question bank & Editor
E1. Question list view: filters, tags, search.
E2. Question create/edit forms per type:
- MCQ
- TRUE_FALSE
- OPEN
- PHOTO_GUESS
- MUSIC_GUESS_YEAR
- YOUTUBE_SCENE_QUESTION
E3. Attach assets (photo).
E4. Attach Spotify ref (track picker + start/duration).
E5. Attach YouTube ref (video id + start/end).
E6. Comments + “soft lock/presence” minimal.
E7. Status handling: draft/published in bank (optional).

## EPIC F — Spotify integration
F1. Spotify app setup docs + redirect handling.
F2. Implement PKCE flow + store refresh token encrypted per workspace.
F3. Track search API proxy (server-side) + caching.
F4. Music question playback UX:
- Host “play clip” using Spotify open (MVP safe)
- Later optional: Web Playback SDK

## EPIC G — YouTube integration
G1. YouTube embed component using IFrame API.
G2. Start/end segment control + reliable stop.
G3. Host controls integrated in reveal/ask flow.

## EPIC H — Quiz Builder
H1. Quiz CRUD.
H2. Rounds CRUD.
H3. Drag & drop ordering of items.
H4. Add item from question bank.
H5. Add minigame item (Swan Race).
H6. Preview mode (simulate).
H7. Publish quiz -> ready to start session.

## EPIC I — Live Session (core)
I1. Create session from quiz (generate code + QR url).
I2. WebSocket protocol design:
- join, lobby update, start item, answer, lock, reveal, leaderboard, next
I3. Host UI:
- lobby, start, controls
I4. Player UI:
- join flow, answer UI for MCQ/TF/OPEN
I5. Scoring engine:
- speed + correctness
- open questions manual scoring option for host
I6. Leaderboard UI and animations.
I7. Robustness: reconnect, late join, duplicate device handling.

## EPIC J — Swan Race minigame
J1. Game UI screen for players + host.
J2. Netcode:
- server authoritative state
- clients send input
J3. Gameplay:
- boat movement
- swan AI chase
- collisions
- timer/end
J4. Score compute & return to main leaderboard.
J5. “minigame item” integration in session state machine.

## EPIC K — Quality
K1. Unit tests for scoring + RBAC.
K2. Integration tests for key APIs.
K3. Playwright smoke: create workspace, create question, create quiz, start session, join player, answer.
K4. Load sanity: 30-60 concurrent players test (basic).
K5. Security checks: rate limits, input validation (zod).

## EPIC L — Deployment to Coolify + Cloudflare Tunnel

L1. Provide Dockerfile(s) or nixpacks config.
L2. Health checks routes (`/healthz` voor web en ws).
L3. Docs: create Postgres + Redis resources in Coolify.
L4. Docs: env vars mapping + security best practices.
L5. Migration run on deploy (automatisch via Coolify build script).
L6. Optional: seed script on first run.
L7. **Cloudflare Tunnel configuratie**:
    - Tunnel route instellen naar Coolify service
    - DNS record aanmaken voor `partyquiz-platform.databridge360.com`
    - WebSocket support verifiëren
    - HTTPS redirect configureren
L8. **Deployment verificatie**:
    - Test app toegankelijk via `https://partyquiz-platform.databridge360.com`
    - WebSocket connectie test
    - Database migrations check
    - Health endpoints monitoring
L9. **CI/CD pipeline**:
    - GitHub webhook naar Coolify
    - Auto-deploy op push naar `main`
    - Rollback strategie documenteren

## EPIC M — Polish (professional finish)
M1. Branding per workspace (logo/colors).
M2. “Reveal” screens: show fun fact + optional “created by”.
M3. Export/import questions (JSON) (optional).
M4. Templates: “Birthday”, “Company”, “Pubquiz” (at least 1).
M5. Admin dashboard: sessions history + results export CSV.

---

## 17) Agent research tasks (Claude: do before final decisions)

Claude moet (met web/search tooling) korte research doen en keuzes onderbouwen voor:

R1) **Coolify + Cloudflare Tunnel deployment pattern**
    - Best practice Next.js + socket.io deployment achter Cloudflare Tunnel
    - WebSocket support via Cloudflare Tunnel
    - Health check configuratie
    - Internal port binding (3000, 8080, etc.)

R2) **Spotify OAuth PKCE constraints** (post-2025 updates)
    - Authorization Code Flow met PKCE implementatie
    - Redirect URI requirements (HTTPS only)
    - Token refresh strategie
    - Workspace-level vs user-level integration

R3) **Hetzner Object Storage**
    - Presigned uploads + CORS commands (AWS CLI compatible)
    - Bucket security best practices
    - CDN/caching strategie (optioneel via Cloudflare)

R4) **YouTube IFrame API**
    - Start/end segment reliability
    - Player state management
    - Mobile compatibility

R5) **PWA & mobile best practices**
    - iOS gyro permissions voor Swan Race
    - PWA installability
    - Offline support (optioneel)
    - Push notifications voor invites (optioneel)

R6) **Cloudflare specifics**
    - Tunnel configuratie voor multiple services (web + ws)
    - DNS proxy settings (orange cloud ON)
    - Rate limiting via Cloudflare (optioneel extra laag)
    - WebSocket upgrade headers

> Output van research: **DECISIONS.md** met bronnen, rationale en implementatie-aanbevelingen

---

## 18) Acceptance criteria (must pass)

**Functionaliteit:**
- Nieuwe user kan workspace aanmaken → invite sturen → editor kan binnenkomen.
- Contributor kan foto uploaden en een photo question maken.
- Editor kan Spotify track koppelen en year-guess vraag maken.
- Editor kan YouTube segment koppelen en video vraag maken.
- Quiz builder kan vragen + Swan Race in volgorde zetten.
- Host start live session → spelers joinen via QR.
- Quiz ronde werkt realtime; leaderboard update werkt.
- Swan Race werkt realtime met 10+ spelers en score komt terug.

**Deployment & infrastructuur:**
- ✅ App is toegankelijk via `https://partyquiz-platform.databridge360.com`
- ✅ HTTPS/TLS werkend via Cloudflare
- ✅ WebSocket connecties stabiel
- ✅ Cloudflare Tunnel correct geconfigureerd
- ✅ Health checks rapporteren correct
- ✅ Database migrations succesvol
- ✅ CI/CD pipeline werkend (push naar main → auto-deploy)

**Performance & stability:**
- 30+ gelijktijdige spelers in één sessie werkt zonder crashes
- Page load < 3s (first contentful paint)
- WebSocket latency < 200ms gemiddeld
- Geen memory leaks na 1 uur continue gebruik

---

## 19) Repo deliverables (wat Claude commit)

**Code structuur:**
- `/apps/web` (Next.js frontend + API routes)
- `/apps/ws` (WebSocket server voor realtime)
- `/packages/shared` (Types, Zod schemas, utilities)
- `prisma/schema.prisma` + migrations
- `package.json` + pnpm workspace configuratie

**Configuratie:**
- Dockerfiles of nixpacks config voor Coolify
- `.env.example` met alle vereiste variabelen
- Health check endpoints (`/healthz`)

**Documentatie (VERPLICHT):**

1. **README.md**
   - Projectoverzicht
   - Lokale development setup
   - Technologie stack
   - Folder structuur
   - Contribution guidelines

2. **COOLIFY_DEPLOY.md** (stap-voor-stap deployment guide)
   - Vereisten (Hetzner VPS, Coolify, Cloudflare)
   - Coolify resources aanmaken (Postgres, Redis)
   - GitHub koppeling instellen
   - Environment variables lijst + uitleg
   - **Cloudflare Tunnel configuratie** (gedetailleerd!)
     - DNS records instellen
     - Tunnel route configureren
     - WebSocket support verifiëren
   - Deployment proces
   - Troubleshooting tips
   - Health check verificatie

3. **DECISIONS.md** (architecturale keuzes & research output)
   - Tech stack rationale
   - Spotify OAuth PKCE implementatie keuzes
   - Object storage strategie
   - WebSocket vs polling keuze
   - Cloudflare Tunnel vs andere opties
   - Security overwegingen
   - Alle bronnen/links

4. **SEED.md** (demo data)
   - Seed script uitleg
   - Demo workspace inhoud
   - Demo vragen per type
   - Test accounts
   - Hoe seed data te gebruiken

5. **TESTING.md**
   - Test strategie
   - Unit tests draaien
   - E2E tests (Playwright)
   - Load testing approach
   - Manual test scenarios
   - CI/CD test integratie

---

## 20) Nota bene (realisme / scope)

- Spotify "automatisch afspelen" via Web Playback SDK kan complex zijn (devices/premium). Start met "Open in Spotify" + host bedient; upgrade later.
- YouTube: embed only; geen video uploads.
- Open questions: host kan markeren (handmatig) om discussie/gezelligheid toe te laten.

---

## Bijlagen: bronnen & referenties

**Spotify integratie:**
- Spotify OAuth migratie reminder: <https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025>
- Spotify PKCE tutorial: <https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow>
- Spotify Web API docs: <https://developer.spotify.com/documentation/web-api>

**YouTube integratie:**
- YouTube IFrame API: <https://developers.google.com/youtube/iframe_api_reference>
- YouTube player parameters: <https://developers.google.com/youtube/player_parameters>

**Hetzner Object Storage:**
- Hetzner CORS for buckets: <https://docs.hetzner.com/storage/object-storage/howto-protect-objects/cors/>
- Hetzner Object Storage overview: <https://docs.hetzner.com/storage/object-storage/overview/>
- S3-compatible API: <https://docs.hetzner.com/storage/object-storage/getting-started/using-s3-api-tools/>

**Coolify deployment:**
- Coolify Next.js docs: <https://coolify.io/docs/applications/nextjs>
- Coolify general tutorial: <https://www.digitalocean.com/community/tutorials/deploy-application-coolify>
- Coolify resources: <https://coolify.io/docs/resources>

**Cloudflare:**
- Cloudflare Tunnel docs: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
- Cloudflare Tunnel met WebSockets: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/origin-configuration/>
- Cloudflare DNS: <https://developers.cloudflare.com/dns/>

---

## EINDE ULTRA MASTER SPEC — EXECUTION SUMMARY

**Claude: voer dit volledig uit, onderbouw alle keuzes, en stop pas bij productieklare oplevering op `https://partyquiz-platform.databridge360.com`**

### ✅ Wat is verwerkt:

**Infrastructuur & Deployment:**
- ✅ Hetzner VPS + Coolify orchestratie (feitelijke situatie)
- ✅ Cloudflare Tunnel (geen publieke poorten)
- ✅ Single domain + path-based routing (`/ws` voor WebSockets)
- ✅ GitHub CI/CD naar `main` branch
- ✅ Specifieke productie-URL als harde eis

**Implementation Constraints (agent-proof):**
- ✅ Auth: Magic link via Auth.js (NextAuth v5)
- ✅ WebSocket routing: Path-based op zelfde domein
- ✅ Media model: Extensible provider-based (UPLOAD|SPOTIFY|YOUTUBE)
- ✅ Game netcode: Server-authoritative (clients send input only)
- ✅ YouTube compliance: Embed only, no download

**Functionaliteit:**
- ✅ Workspaces + RBAC (Owner → Admin → Editor → Contributor → Viewer)
- ✅ Centrale vraagbank (15+ vraagtypes)
- ✅ Quiz builder met drag & drop
- ✅ Live sessions met realtime scoring
- ✅ Swan Race minigame (verplicht)
- ✅ Spotify PKCE integratie
- ✅ YouTube IFrame embed

**Kwaliteit & Documentatie:**
- ✅ 17 Epics met gedetailleerde taken
- ✅ Research taken voor actuele API's
- ✅ Acceptance criteria (functionaliteit + deployment + performance)
- ✅ Volledige documentatie-eisen (5 verplichte docs)

### 🎯 Claude's eindverantwoordelijkheid:

1. **Bouwen**: Alle 17 epics implementeren
2. **Testen**: Unit + E2E + load tests
3. **Deployen**: Werkend op `https://partyquiz-platform.databridge360.com`
4. **Documenteren**: README, COOLIFY_DEPLOY (met Tunnel!), DECISIONS, SEED, TESTING
5. **Verifiëren**: Alle acceptance criteria gehaald

**PAS STOPPEN ALS:**
- App live is op productie-URL
- WebSockets werken
- 30+ spelers test geslaagd
- Cloudflare Tunnel correct geconfigureerd
- Alle documentatie compleet

---

**Dit is de complete, definitieve specificatie. Succes! 🚀**
