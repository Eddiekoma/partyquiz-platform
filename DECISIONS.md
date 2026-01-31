# 🎯 Architecture Decisions & Research

This document captures all major architectural decisions, research findings, and rationale for the PartyQuiz Platform.

## � Changelog

### 2026-01-30 - Dependency Updates & Build Fixes

**Updates:**
- ✅ NextAuth upgraded from 5.0.0-beta.4 → **4.24.13** (stable)
- ✅ @auth/prisma-adapter upgraded to **2.11.1** (latest)
- ✅ nodemailer upgraded from 6.10.1 → **7.0.13** (latest)
- ✅ Added Suspense boundary to signin page for useSearchParams
- ✅ Created NextAuth type declarations for session.user.id
- ✅ Migrated NextAuth v5 beta API to v4 stable API

**Prisma Schema Updates:**
- ✅ Added `description` field to Workspace model
- ✅ Added `invitedById` field and User relation to WorkspaceInvite
- ✅ Fixed AuditLog fields (`actorUserId`, `payloadJson`)

**CSS Architecture:**
- ✅ Professional globals.css with CSS custom properties
- ✅ Custom scrollbar styling (Webkit + Firefox)
- ✅ Component utility classes (spinner, skeleton, answer-card, host-text)
- ✅ Party mode animations (pulse, glow)
- ✅ Gradient utilities and print styles

**Rationale:**
- Using stable NextAuth v4 instead of beta v5 for production reliability
- nodemailer v7 required by latest @auth/core for security improvements
- CSS custom properties provide themeable design system foundation

---

## �📚 Table of Contents

1. [Infrastructure & Deployment](#infrastructure--deployment)
2. [Authentication Strategy](#authentication-strategy)
3. [Media & Storage Model](#media--storage-model)
4. [WebSocket Architecture](#websocket-architecture)
5. [Spotify Integration](#spotify-integration)
6. [YouTube Integration](#youtube-integration)
7. [Game Server Design](#game-server-design)

---

## Infrastructure & Deployment

### Decision: Single Domain + Path-Based Routing

**Choice:** Use one domain with path-based routing for web app and WebSockets.

**URL Structure:**
- Web app: `https://partyquiz-platform.databridge360.com`
- WebSocket: `wss://partyquiz-platform.databridge360.com/ws`

**Rationale:**
1. **Simpler DNS management** - Only one DNS record needed
2. **No CORS issues** - Same-origin for API and WebSocket
3. **Single certificate** - One TLS cert from Cloudflare
4. **Easier to document** - Users don't need to configure multiple domains

**Alternatives Considered:**
- Separate subdomain for WS (`ws.partyquiz-platform.databridge360.com`)
  - ❌ More complex DNS setup
  - ❌ Additional CORS configuration needed
  - ❌ Two Cloudflare Tunnel routes

**Implementation:**
```yaml
# Cloudflare Tunnel config
ingress:
  - hostname: partyquiz-platform.databridge360.com
    path: /ws*
    service: http://localhost:8080
  - hostname: partyquiz-platform.databridge360.com
    service: http://localhost:3000
```

**Sources:**
- Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- WebSocket over same domain: Best practice for same-origin policy

---

## Authentication Strategy

### Decision: Magic Link (Passwordless) via Auth.js

**Choice:** Email-based magic link authentication using Auth.js (NextAuth v5).

**Rationale:**
1. **Better UX** - No passwords to remember
2. **More secure** - No password breaches, no weak passwords
3. **HTTPS-aware** - Works seamlessly with Cloudflare Tunnel
4. **Built-in rate limiting** - Prevents email spam
5. **Database sessions** - Secure, server-side sessions

**Implementation Details:**
- **Library:** Auth.js v5 (next-auth@beta)
- **Provider:** Email with verification tokens
- **Session strategy:** Database (not JWT)
- **Cookie settings:** httpOnly, secure, sameSite=lax
- **Rate limiting:** Max 3 emails per 5 minutes per email address

**Configuration:**
```typescript
{
  adapter: PrismaAdapter(prisma),
  providers: [EmailProvider(...)],
  session: { strategy: "database" },
  trustHost: true, // Required for Cloudflare Tunnel
}
```

**Alternatives Considered:**
- **Password-based** (email + password)
  - ❌ Users forget passwords
  - ❌ Need password reset flow
  - ❌ Security risk (weak passwords, breaches)
  
- **OAuth only** (Google, GitHub, etc.)
  - ❌ Not everyone has these accounts
  - ❌ Corporate/enterprise users may prefer email

- **JWT sessions**
  - ❌ Cannot invalidate tokens server-side
  - ❌ Less secure for sensitive operations

**Future Extensions:**
- Add OAuth providers (Google, Microsoft) as optional
- Add 2FA for workspace owners (optional)

**Sources:**
- Auth.js docs: https://authjs.dev/
- Passwordless best practices: https://web.dev/security-credential-management/

---

## Media & Storage Model

### Decision: Extensible Provider-Based Media Model

**Choice:** Flexible `QuestionMedia` model supporting multiple providers via JSON references.

**Schema:**
```prisma
model QuestionMedia {
  id         String @id
  questionId String
  provider   String // "UPLOAD", "SPOTIFY", "YOUTUBE"
  mediaType  String // "IMAGE", "AUDIO", "VIDEO"
  reference  Json   // Flexible: {trackId, videoId, assetId, etc.}
  metadata   Json?  // Optional: {startMs, durationMs, title, etc.}
  order      Int
}
```

**Rationale:**
1. **Future-proof** - Easy to add new providers (e.g., TikTok, SoundCloud)
2. **No schema changes** - New providers don't require migrations
3. **Flexible references** - Each provider can store what it needs
4. **Type-safe** - Can validate with Zod schemas per provider

**Reference Examples:**

**Upload (user media):**
```json
{
  "provider": "UPLOAD",
  "reference": { "assetId": "cuid123" },
  "metadata": { "title": "My Photo" }
}
```

**Spotify:**
```json
{
  "provider": "SPOTIFY",
  "reference": {
    "trackId": "3n3Ppam7vgaVa1iaRUc9Lp",
    "startMs": 30000,
    "durationMs": 30000
  },
  "metadata": {
    "title": "Mr. Brightside",
    "artist": "The Killers"
  }
}
```

**YouTube:**
```json
{
  "provider": "YOUTUBE",
  "reference": {
    "videoId": "dQw4w9WgXcQ",
    "startSeconds": 10,
    "endSeconds": 40
  },
  "metadata": {
    "title": "Never Gonna Give You Up"
  }
}
```

**Alternatives Considered:**
- **Separate tables per provider**
  - ❌ More complex schema
  - ❌ Harder to query all media for a question
  - ❌ Schema changes for new providers

- **Single polymorphic column**
  - ❌ Less type-safe
  - ❌ Harder to validate

**Validation:**
```typescript
// Provider-specific validation
const spotifyReferenceSchema = z.object({
  trackId: z.string(),
  startMs: z.number().min(0).default(0),
  durationMs: z.number().min(1000).max(60000).default(30000),
});
```

**Sources:**
- Prisma JSON fields: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#json-fields
- Extensibility patterns: https://martinfowler.com/articles/refactoring-external-service.html

---

## WebSocket Architecture

### Decision: Separate WebSocket Server (Socket.io)

**Choice:** Dedicated Node.js server running Socket.io for realtime communication.

**Architecture:**
```
┌─────────────┐     HTTP/REST      ┌──────────────┐
│   Client    │ ──────────────────> │  Next.js App │
│   Browser   │                     │  (port 3000) │
└─────────────┘                     └──────────────┘
       │
       │ WebSocket
       │ (wss://.../ws)
       ▼
┌─────────────────┐
│ Socket.io Server│
│  (port 8080)    │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│     Redis       │
│  (pub/sub)      │
└─────────────────┘
```

**Rationale:**
1. **Separation of concerns** - HTTP and WS have different scaling needs
2. **Better performance** - Dedicated process for WebSocket connections
3. **Easier debugging** - Separate logs for WS traffic
4. **Horizontal scaling** - Can scale WS server independently
5. **Redis adapter** - Multiple WS instances can share state via Redis

**Socket.io Benefits:**
- Auto-reconnection
- Fallback to polling (if WebSocket fails)
- Room-based broadcasting
- Binary data support
- TypeScript support

**Message Protocol:**
```typescript
enum WSMessageType {
  // Client -> Server
  JOIN_SESSION = "JOIN_SESSION",
  SUBMIT_ANSWER = "SUBMIT_ANSWER",
  GAME_INPUT = "GAME_INPUT",
  
  // Server -> Client
  SESSION_STATE = "SESSION_STATE",
  PLAYER_JOINED = "PLAYER_JOINED",
  ITEM_STARTED = "ITEM_STARTED",
  LEADERBOARD_UPDATE = "LEADERBOARD_UPDATE",
  GAME_STATE = "GAME_STATE",
}
```

**Alternatives Considered:**
- **Next.js Custom Server with Socket.io**
  - ❌ Complicates Next.js deployment
  - ❌ Harder to scale independently
  
- **Server-Sent Events (SSE)**
  - ❌ Unidirectional only (server → client)
  - ❌ Doesn't work well for games (need client → server)
  
- **Pusher/Ably (third-party)**
  - ❌ Additional cost
  - ❌ External dependency
  - ❌ Data leaves our infrastructure

**State Management:**
- **In-memory** (single instance) - OK for MVP
- **Redis** (production) - Required for multi-instance deployment

**Sources:**
- Socket.io docs: https://socket.io/docs/v4/
- Redis adapter: https://socket.io/docs/v4/redis-adapter/

---

## Spotify Integration

### Decision: OAuth Authorization Code Flow with PKCE

**Choice:** Use Spotify's modern Authorization Code Flow with PKCE for secure OAuth.

**Background:**
Spotify deprecated the Implicit Grant flow (client-side) and now requires:
- Authorization Code Flow
- PKCE (Proof Key for Code Exchange)
- HTTPS redirect URIs

**Implementation:**

**1. OAuth Flow:**
```
User clicks "Connect Spotify"
    ↓
Redirect to Spotify with PKCE challenge
    ↓
User authorizes app
    ↓
Spotify redirects to: /api/auth/spotify/callback?code=...
    ↓
Exchange code for tokens (with PKCE verifier)
    ↓
Store refresh_token (encrypted) in database
```

**2. Token Storage:**
```prisma
model SpotifyIntegration {
  id                    String @id
  workspaceId           String @unique
  encryptedRefreshToken String @db.Text
  scopesJson            Json
  createdAt             DateTime
  updatedAt             DateTime
}
```

**3. Required Scopes:**
```typescript
const SPOTIFY_SCOPES = [
  "user-read-email",
  "playlist-read-private",
  "user-library-read",
  // Optional: "streaming" (for Web Playback SDK)
];
```

**4. Playback Strategy:**

**MVP (Simple):**
- Store track ID + start/duration
- Host opens Spotify manually
- Host controls playback

**Future (Advanced):**
- Spotify Web Playback SDK
- Browser-based playback
- Requires Premium account
- More complex but better UX

**Rationale for MVP approach:**
1. **Simpler** - No Premium account required
2. **Faster to build** - Less complexity
3. **Works for most use cases** - Host has Spotify open anyway
4. **Can upgrade later** - PKCE tokens support SDK

**Track Search & Caching:**
```typescript
// Server-side API proxy (avoids exposing client secret)
GET /api/spotify/search?q=artist:the%20killers
```

**Security:**
- Client secret NEVER sent to browser
- All Spotify API calls server-side
- Refresh token encrypted with workspace-level key
- Rate limiting on search endpoint

**Alternatives Considered:**
- **Spotify Embed Player** (iframe)
  - ❌ Limited control over playback
  - ❌ Can't programmatically start/stop
  
- **Direct link to Spotify Web**
  - ❌ Poor UX (opens new tab)
  - ❌ No automatic playback

**Sources:**
- Spotify OAuth migration: https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025
- PKCE flow tutorial: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- Web API reference: https://developer.spotify.com/documentation/web-api

---

## YouTube Integration

### Decision: IFrame Player API with Segment Control

**Choice:** Use YouTube IFrame Player API for controlled video playback.

**Implementation:**

**1. Video Reference Storage:**
```typescript
{
  provider: "YOUTUBE",
  reference: {
    videoId: "dQw4w9WgXcQ",
    startSeconds: 10,
    endSeconds: 40
  }
}
```

**2. Player Configuration:**
```typescript
// Load YouTube IFrame API
const player = new YT.Player('player', {
  videoId: 'dQw4w9WgXcQ',
  playerVars: {
    start: 10,
    end: 40,
    autoplay: 1,
    controls: 0, // Hide controls
    modestbranding: 1,
    rel: 0, // No related videos
  },
  events: {
    onReady: (event) => event.target.playVideo(),
    onStateChange: (event) => {
      if (event.data === YT.PlayerState.ENDED) {
        // Video segment ended
        handleSegmentComplete();
      }
    },
  },
});
```

**3. Segment Playback:**
```typescript
// Precise segment control
player.loadVideoById({
  videoId: 'dQw4w9WgXcQ',
  startSeconds: 10,
  endSeconds: 40,
});

// Monitor playback
setInterval(() => {
  const currentTime = player.getCurrentTime();
  if (currentTime >= endSeconds) {
    player.pauseVideo();
  }
}, 100);
```

**Rationale:**
1. **Compliant** - Uses official API, respects YouTube ToS
2. **No download** - Streams from YouTube servers
3. **Reliable** - Well-documented, stable API
4. **Mobile-friendly** - Works on iOS/Android
5. **Free** - No API key needed (for embed)

**Compliance:**
- ✅ Embed only (no re-hosting)
- ✅ Respects copyright (YouTube handles it)
- ✅ No download/ripping
- ✅ Official API usage

**Mobile Considerations:**
- iOS requires user gesture to play video
- Solution: "Tap to play" button for first video
- Auto-play works after first interaction

**Alternatives Considered:**
- **Direct video downloads**
  - ❌ Violates YouTube ToS
  - ❌ Copyright issues
  
- **YouTube Data API v3**
  - ❌ Overkill (we just need embed)
  - ❌ Requires API key & quota management

**Sources:**
- IFrame API reference: https://developers.google.com/youtube/iframe_api_reference
- Player parameters: https://developers.google.com/youtube/player_parameters
- YouTube ToS: https://www.youtube.com/static?template=terms

---

## Game Server Design

### Decision: Server-Authoritative Netcode

**Choice:** Server calculates all game state; clients send input only.

**Architecture:**

```
Client (Browser)                Server (WebSocket)
    │                               │
    │  INPUT: {direction, throttle} │
    ├───────────────────────────────>
    │                               │
    │                          ┌────┴─────┐
    │                          │ Physics  │
    │                          │ Engine   │
    │                          │          │
    │                          │ - Positions
    │                          │ - Collisions
    │                          │ - Swan AI
    │                          │ - Power-ups
    │                          └────┬─────┘
    │                               │
    │  GAME_STATE (20Hz tick)       │
    │<────────────────────────────────
    │                               │
    │  Render locally               │
    │  (interpolate)                │
    │                               │
```

**Rationale:**
1. **Anti-cheat** - Clients cannot manipulate positions/scores
2. **Fair gameplay** - Server is source of truth
3. **Predictable** - All clients see same game state (with latency)
4. **Simpler** - No client-side prediction complexity (MVP)

**Input Schema:**
```typescript
interface PlayerInput {
  direction: { x: number; y: number }; // Normalized -1 to 1
  throttle: number; // 0 to 1
}
```

**Game State Broadcast:**
```typescript
interface GameState {
  tick: number;
  players: Array<{
    id: string;
    position: { x: number; y: number };
    rotation: number;
    velocity: { x: number; y: number };
    isAlive: boolean;
    score: number;
  }>;
  swans: Array<{
    id: string;
    position: { x: number; y: number };
    rotation: number;
    targetPlayerId: string | null;
  }>;
  powerUps: Array<{
    id: string;
    type: "FISH_LURE" | "TURBO" | "SHIELD";
    position: { x: number; y: number };
  }>;
  timeRemaining: number;
}
```

**Tick Rate:**
- Server: 20Hz (50ms per tick)
- Broadcast: Every tick (20Hz)
- Input accepted: Any time (queued for next tick)

**Client Prediction (Optional Future):**
- For MVP: Just render what server sends
- For better UX: Interpolate between states (lerp)
- Advanced: Dead reckoning + server reconciliation

**Swan AI:**
```typescript
// Server-side AI behavior
function updateSwanAI(swan: Swan, players: Player[]) {
  // Find nearest alive player
  const target = findNearestPlayer(swan, players);
  
  // Chase with some randomness
  const direction = normalize(target.position - swan.position);
  const speed = SWAN_SPEED + Math.random() * SWAN_SPEED_VARIANCE;
  
  swan.velocity = direction * speed;
  swan.rotation = Math.atan2(direction.y, direction.x);
}
```

**Collision Detection:**
- AABB (Axis-Aligned Bounding Box) for simplicity
- Circle-circle for boats and swans
- Quad-tree for optimization (if needed)

**Alternatives Considered:**
- **Client-authoritative** (client sends positions)
  - ❌ Easy to cheat
  - ❌ Unfair gameplay
  
- **Peer-to-peer**
  - ❌ Complex NAT traversal
  - ❌ Hard to moderate

**Sources:**
- Gabriel Gambetta's Fast-Paced Multiplayer: https://www.gabrielgambetta.com/client-server-game-architecture.html
- Valve's networking articles: https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking

---

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Routing** | Single domain + path-based | Simpler DNS, no CORS |
| **Auth** | Magic link (passwordless) | Better UX, more secure |
| **Media Model** | Extensible JSON references | Future-proof, no schema changes |
| **WebSocket** | Separate Socket.io server | Better scaling, separation of concerns |
| **Spotify** | OAuth PKCE + server-side API | Secure, compliant with modern OAuth |
| **YouTube** | IFrame API with segments | Compliant, reliable, mobile-friendly |
| **Game Server** | Server-authoritative netcode | Anti-cheat, fair gameplay |

---

**Last Updated:** January 30, 2026  
**Version:** 1.0.0
