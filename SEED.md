# 🌱 Database Seeding Guide

Complete guide for seeding the PartyQuiz Platform database with demo data.

## What's Included

The seed script creates a complete demo environment:

### Users (3)
- **admin@partyquiz.demo** - Workspace Owner
- **host@partyquiz.demo** - Admin role (can host sessions)
- **editor@partyquiz.demo** - Editor role (can create questions)

### Workspace
- **Name**: Demo Workspace
- **Slug**: `demo-workspace`
- **Members**: All 3 users with different roles

### Questions (12)
Covering all main question types:

1. **MC_SINGLE** - Capital of France (Paris)
2. **MC_MULTIPLE** - Programming languages (Python, JavaScript)
3. **TRUE_FALSE** - The Earth is flat (False)
4. **OPEN_TEXT** - Famous painting (Mona Lisa)
5. **ESTIMATION** - Days in a year (365)
6. **ORDER** - Planets by distance (Mercury → Venus → Earth → Mars)
7. **PHOTO_QUESTION** - Landmark photo (Eiffel Tower)
8. **MUSIC_GUESS_TITLE** - Spotify track (Mr. Brightside)
9. **MUSIC_GUESS_ARTIST** - Spotify artist (The Weeknd)
10. **YOUTUBE_SCENE_QUESTION** - YouTube video scene
11. **POLL** - Favorite pizza topping (no correct answer)
12. **PHOTO_OPEN** - Historical figure (Albert Einstein)

### Quizzes (3)

#### 1. General Knowledge Quiz
- **Round 1: Basics** (3 questions)
  - Capital of France
  - Earth is flat (T/F)
  - Days in a year
- **Round 2: Challenge** (2 questions + 1 minigame)
  - Programming languages
  - Planet order
  - Swan Race minigame

#### 2. 🎵 Music Quiz
- **Music Round** (2 questions)
  - Name that song (Spotify)
  - Name that artist (Spotify)

#### 3. 🎉 Party Quiz
- **Party Round** (3 questions)
  - Landmark photo
  - Pizza poll
  - YouTube scene

### Live Session
- **Code**: `DEMO123`
- **Status**: LOBBY (waiting for host to start)
- **Quiz**: General Knowledge Quiz
- **Players**: Alice (🦄), Bob (🐻)

---

## How to Run

### Prerequisites
- PostgreSQL database running
- Database URL configured in `.env`
- Prisma CLI installed

### Command

```bash
# From project root
pnpm prisma db seed

# OR from apps/web directory
cd apps/web
npx prisma db seed
```

### Expected Output

```
🌱 Seeding PartyQuiz Platform...

🧹 Cleaning database...
👤 Creating users...
🏢 Creating workspace...
❓ Creating questions...
✅ Created 12 questions
📝 Creating quizzes...
✅ Created 3 quizzes
🎮 Creating demo session...
✅ Created demo session

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Seeding Complete!

📊 Created:
  • 3 users
  • 1 workspace
  • 12 questions (all types)
  • 3 quizzes
  • 1 live session

🔑 Demo Credentials:
  • admin@partyquiz.demo
  • host@partyquiz.demo
  • editor@partyquiz.demo

🎯 Session Code: DEMO123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Configuration

### package.json

The seed script is configured in `apps/web/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

### Seed File Location

```
apps/web/prisma/seed.ts
```

---

## Using the Demo Data

### 1. Login

Navigate to `http://localhost:3000` and login with any demo email:
- `admin@partyquiz.demo`
- `host@partyquiz.demo`
- `editor@partyquiz.demo`

You'll receive a magic link email (check your email provider logs or Maildev inbox).

### 2. Explore Workspace

After login, you'll see the "Demo Workspace" with:
- **Questions page**: 12 pre-created questions
- **Quizzes page**: 3 complete quizzes ready to use
- **Sessions page**: 1 active demo session

### 3. Join Demo Session

Open a new incognito window or different browser:
1. Navigate to `http://localhost:3000/play`
2. Enter code: `DEMO123`
3. Enter your name
4. Join the session

### 4. Host Demo Session

As the host:
1. Go to Sessions → find DEMO123
2. Click "Open Session"
3. Start the quiz
4. Play through questions
5. View real-time leaderboard

---

## Resetting the Database

### Option 1: Reset + Migrate + Seed (Clean Slate)

```bash
pnpm prisma migrate reset
```

This will:
1. Drop all tables
2. Run all migrations
3. Automatically run seed script
4. Give you a fresh database with demo data

### Option 2: Manual Reset

```bash
# Delete all data
pnpm prisma db push --force-reset

# Run migrations
pnpm prisma migrate deploy

# Seed data
pnpm prisma db seed
```

---

## Customizing Seed Data

### Disable Cleanup

If you want to keep existing data and add demo data:

```typescript
// In apps/web/prisma/seed.ts

async function main() {
  console.log('🌱 Seeding PartyQuiz Platform...\n');

  // Comment out cleanup section
  /*
  console.log('🧹 Cleaning database...');
  await prisma.liveAnswer.deleteMany();
  await prisma.livePlayer.deleteMany();
  // ... etc
  */

  // Rest of seed script...
}
```

### Add More Questions

```typescript
const q13 = await prisma.question.create({
  data: {
    workspaceId: workspace.id,
    type: 'MC_SINGLE',
    title: 'Your Question Title',
    prompt: 'Your question text?',
    difficulty: 3,
    status: 'PUBLISHED',
    createdBy: editor.id,
    options: {
      create: [
        { text: 'Option A', isCorrect: true, order: 1 },
        { text: 'Option B', isCorrect: false, order: 2 },
        { text: 'Option C', isCorrect: false, order: 3 },
        { text: 'Option D', isCorrect: false, order: 4 },
      ],
    },
  },
});
```

### Add Spotify/YouTube Media

```typescript
// For Spotify tracks
media: {
  create: [{
    provider: 'SPOTIFY',
    mediaType: 'AUDIO',
    reference: { trackId: '3n3Ppam7vgaVa1iaRUc9Lp' },
    metadata: { startMs: 10000, durationMs: 30000 },
    order: 1,
  }],
}

// For YouTube videos
media: {
  create: [{
    provider: 'YOUTUBE',
    mediaType: 'VIDEO',
    reference: { videoId: 'dQw4w9WgXcQ' },
    metadata: { startMs: 42000, durationMs: 15000 },
    order: 1,
  }],
}

// For uploaded files
media: {
  create: [{
    provider: 'UPLOAD',
    mediaType: 'IMAGE',
    reference: { url: 'path/to/image.jpg' },
    order: 1,
  }],
}
```

---

## Production Considerations

### ⚠️ DO NOT Seed Production

The seed script is for **development and testing only**. It:
- Deletes all existing data
- Creates demo users with predictable emails
- Uses public Spotify/YouTube IDs

### Alternative for Production

Instead of seeding, consider:
1. **Manual setup** - Have first user create workspace manually
2. **Import tools** - Use question import API endpoints
3. **Templates** - Create quiz templates feature (see EPIC M2)

---

## Troubleshooting

### Error: "Prisma Client not found"

```bash
# Generate Prisma client
pnpm prisma generate
```

### Error: "ts-node not found"

```bash
# Install ts-node
cd apps/web
pnpm add -D ts-node
```

### Error: "Can't resolve '@prisma/client'"

```bash
# Install dependencies
pnpm install
pnpm prisma generate
```

### Seed runs but no data appears

Check:
1. Database connection string in `.env`
2. Database is running
3. Migrations are applied: `pnpm prisma migrate deploy`
4. Check logs for errors

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run migrations
        run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      # Only seed in staging/preview environments
      - name: Seed database
        if: github.ref == 'refs/heads/staging'
        run: pnpm prisma db seed
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
```

---

## Related Documentation

- [COOLIFY_DEPLOY.md](./COOLIFY_DEPLOY.md) - Production deployment
- [PartyQuiz_Platform.md](./PartyQuiz_Platform.md) - Platform specification
- [MEDIA_LIBRARY.md](./MEDIA_LIBRARY.md) - Media upload setup

---

**Last Updated**: January 31, 2026  
**Version**: 1.0.0
