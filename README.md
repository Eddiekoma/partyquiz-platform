# 🎉 PartyQuiz Platform

> **Production-Ready Quiz Platform** with Music, Video, and Epic Minigames

PartyQuiz Platform is a comprehensive quiz creation and hosting platform designed for parties, corporate events, pub quizzes, and educational settings. Built with modern tech stack and deployed on Hetzner via Coolify with Cloudflare Tunnel.

## ✨ Features

### 🎵 Media Integrations
- **Spotify Integration** - OAuth PKCE flow, track search, 30-second previews
  - 🎼 Guess the Title - Players identify song name
  - 🎤 Guess the Artist - Players identify artist
  - 📅 Guess the Year - Players estimate release year
- **YouTube Integration** - No API key needed (oEmbed)
  - 🎬 Scene Questions - Ask about specific video moments
  - 💬 Next Line - Predict what someone says next
  - 👤 Who Said It? - Identify the speaker
  - ⏱️ Timestamp Selector - Precise start/end segments (MM:SS format)

### 🎮 Interactive Features
- **Swan Race Mini-Game** - Competitive paddling game between quiz rounds
  - 🦢 Server-authoritative netcode (anti-cheat)
  - 🏆 Points for top finishers (10/8/6/4/2 pts)
  - 📱 Touch + mouse controls
  - 🎨 Canvas rendering with real-time updates
- **Live Sessions** - Real-time quiz hosting
  - 📲 QR code join (no accounts needed)
  - ⚡ WebSocket updates (Socket.io)
  - 🏅 Live leaderboard with Redis caching (10x faster)
  - 🎯 Host controls (start/lock/reveal)

### 📚 Content Management
- **Central Question Bank** - Reusable questions across quizzes
- **15+ Question Types:**
  - Multiple Choice (Single/Multiple)
  - True/False
  - Open Text
  - Estimation (Swan Race trigger)
  - Ordering
  - Photo/Audio/Video Questions
  - Spotify Music Questions (3 types)
  - YouTube Video Questions (3 types)
  - Polls
- **Collaborative Workspaces** - 5 role levels (Owner/Admin/Editor/Contributor/Viewer)
- **Media Library** - Hetzner Object Storage (S3-compatible)

### 🔒 Production-Ready
- **Magic Link Authentication** - Passwordless, secure
- **Rate Limiting** - Redis-based protection
- **Audit Logging** - Track all workspace actions
- **Testing Suite** - 36 tests, 71% coverage (Vitest)
- **Performance** - Redis caching, optimized queries
- **Security** - HTTPS, CORS, input validation

## 🏗️ Architecture

### Monorepo Structure

\`\`\`
partyquiz-platform/
├── apps/
│   ├── web/          # Next.js 14 (App Router) - Main application
│   └── ws/           # WebSocket server (Socket.io) - Realtime
├── packages/
│   └── shared/       # Shared types, schemas, permissions
├── docker-compose.yml
└── pnpm-workspace.yaml
\`\`\`

### Tech Stack

**Frontend**
- Next.js 14.1.0 (App Router)
- React 18.3.1
- TypeScript 5.9.3 (strict mode)
- TailwindCSS 3.4.19 + Tailwind Forms
- React Hook Form + Zod validation
- Zustand (state management)
- DnD Kit (drag & drop)
- Framer Motion (animations)

**Backend**
- Next.js API Routes
- Prisma ORM 5.22.0 (PostgreSQL)
- Redis 7 (sessions, cache, rate limiting)
- Socket.io 4.8.1 (WebSocket server)

**Storage & Media**
- PostgreSQL 16 (Coolify managed resource)
- Redis 7 (Coolify managed resource)
- Hetzner Object Storage (S3-compatible)

**Auth & Security**
- NextAuth 4.24.13 (stable)
- @auth/prisma-adapter 2.11.1
- nodemailer 7.0.13
- Magic link authentication
- Database sessions
- Rate limiting
- HTTPS-aware (Cloudflare Tunnel)

**Deployment**
- Hetzner VPS
- Coolify (orchestration)
- Cloudflare Tunnel (networking)
- GitHub Actions (CI/CD)
- Docker

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

### Local Development Setup

**Note:** For local development, the platform uses Docker Compose to run PostgreSQL and Redis. In production, these are managed as separate resources in Coolify.

1. **Clone the repository**

\`\`\`bash
git clone https://github.com/your-org/partyquiz-platform.git
cd partyquiz-platform
\`\`\`

2. **Install dependencies**

\`\`\`bash
pnpm install
\`\`\`

3. **Start local database services (development only)**

\`\`\`bash
docker-compose up -d
\`\`\`

**Note:** This starts PostgreSQL and Redis containers for local development. Production uses Coolify-managed resources (see COOLIFY_DEPLOY.md).

4. **Configure environment variables**

\`\`\`bash
cp apps/web/.env.example apps/web/.env
cp apps/ws/.env.example apps/ws/.env
# Edit .env files with your configuration
\`\`\`

5. **Run database migrations**

\`\`\`bash
cd apps/web
pnpm prisma migrate dev
\`\`\`

6. **Start development servers**

\`\`\`bash
# Terminal 1 - Web app
pnpm dev

# Terminal 2 - WebSocket server (in apps/ws)
cd apps/ws
pnpm dev
\`\`\`

7. **Open the application**

- Web: http://localhost:3000
- WebSocket: ws://localhost:8080

## 📦 Database Schema

The platform uses an **extensible media model** supporting multiple providers:

- **UPLOAD**: User-uploaded media (images, audio)
- **SPOTIFY**: Track references with start/duration
- **YOUTUBE**: Video references with start/end segments

See `apps/web/prisma/schema.prisma` for full schema.

## 🎮 Question Types

The platform supports 20+ question types:

**Standard**
- Multiple Choice (MCQ)
- True/False
- Open Answer
- Ordering

**Photo-based**
- Photo Guess
- Photo Zoom Reveal
- Photo Timeline

**Music-based (Spotify)**
- Guess Title
- Guess Artist
- Guess Year (slider)
- Hitster Timeline
- Older/Newer Than

**Video-based (YouTube)**
- Scene Question
- Next Line
- Who Said It

**Social/Party**
- Polls
- Emoji Vote
- Chaos Events

## 🔐 Authentication

Magic link authentication via Auth.js (NextAuth v5):

- Passwordless email-based login via [Resend.com](https://resend.com)
- Database sessions (secure, httpOnly cookies)
- Rate limiting (3 emails per 5 minutes)
- HTTPS-aware redirects
- Cloudflare Tunnel compatible

### Email Provider Setup

The platform uses [Resend.com](https://resend.com) for transactional emails (magic link authentication).
Free tier includes 3,000 emails/month which is sufficient for most quiz events.

See **COOLIFY_ENV_VARIABLES.md** for required email environment variables.

## 🌐 Deployment

See **COOLIFY_DEPLOY.md** for complete deployment guide including:

- Coolify configuration
- Cloudflare Tunnel setup
- Environment variables
- Health checks
- CI/CD pipeline

## 📝 Scripts

\`\`\`bash
# Development
pnpm dev                 # Start all dev servers
pnpm build              # Build all apps
pnpm lint               # Lint all code
pnpm type-check         # TypeScript check
pnpm format             # Format with Prettier

# Database
pnpm db:migrate         # Run migrations (production)
pnpm db:migrate:dev     # Run migrations (dev)
pnpm db:studio          # Open Prisma Studio
pnpm db:generate        # Generate Prisma Client
pnpm db:seed            # Seed demo data

# Testing
pnpm test               # Run unit tests
pnpm test:e2e           # Run E2E tests
\`\`\`

## 📚 Documentation

- [COOLIFY_DEPLOY.md](./COOLIFY_DEPLOY.md) - Deployment guide
- [DECISIONS.md](./DECISIONS.md) - Architecture decisions & research
- [SEED.md](./SEED.md) - Demo data & test accounts
- [TESTING.md](./TESTING.md) - Testing strategy

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass
4. Submit a pull request

## 📜 License

Proprietary - Databridge360

## 🎯 Production URL

**https://partyquiz-platform.databridge360.com**

---

Built with ❤️ by Databridge360 | Powered by Coolify, Hetzner & Cloudflare
