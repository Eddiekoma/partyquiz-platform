# 🧪 PartyQuiz Platform - Testing Guide

**Purpose:** Step-by-step testing guide to verify all features work before production deployment.

**Current Status:** 98% complete - Ready for manual testing phase

---

## Prerequisites

### Option A: Local Testing (Without Docker)
**Requirements:**
- Node.js 18+ installed ✅
- PostgreSQL installed locally OR use managed database
- Redis installed locally OR use managed Redis
- Environment variables configured

### Option B: Production-Like Testing (With Docker)
**Requirements:**
- Docker Desktop installed
- docker-compose.yml configured
- Run: `docker compose up -d`

---

## Setup Steps

### 1. Environment Configuration

**Create `.env` file in project root:**
```bash
cp .env.example .env
```

**Minimal working configuration (for local testing):**
```bash
# Database (Local PostgreSQL OR Coolify managed)
DATABASE_URL=postgresql://user:password@host:5432/partyquiz

# Redis (Local Redis OR Coolify managed)
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Email (use Ethereal for testing - no real emails)
EMAIL_FROM=test@partyquiz.com
EMAIL_SERVER_HOST=smtp.ethereal.email
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your_ethereal_user
EMAIL_SERVER_PASSWORD=your_ethereal_password

# Spotify (optional - only for music questions)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback

# YouTube (optional - only for video questions)
YOUTUBE_API_KEY=your_api_key

# S3/Hetzner (optional - only for file uploads)
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_BUCKET_NAME=partyquiz
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_REGION=eu-central-1
```

**Get Ethereal Email (Free Testing SMTP):**
1. Go to https://ethereal.email/create
2. Copy credentials to .env
3. All emails visible at https://ethereal.email/messages

### 2. Database Setup

**Run migrations:**
```bash
cd apps/web
pnpm prisma migrate deploy
```

**Seed database with test data:**
```bash
pnpm prisma db seed
```

**Expected output:**
- ✅ 3 template quizzes created
- ✅ 24 sample questions created
- ✅ Test workspace created

### 3. Start Development Servers

**Terminal 1 - Web App:**
```bash
cd apps/web
pnpm dev
```
Expected: Running on http://localhost:3000

**Terminal 2 - WebSocket Server:**
```bash
cd apps/ws
pnpm dev
```
Expected: Running on http://localhost:3001

**Terminal 3 - Shared Package Watch (optional):**
```bash
cd packages/shared
pnpm dev
```

---

## Manual Testing Checklist

### Phase 1: Authentication ✅ (5 minutes)

**Test 1.1: Magic Link Sign In**
1. Open http://localhost:3000
2. Click "Sign In"
3. Enter email address
4. Click "Send Magic Link"
5. ✅ Check Ethereal inbox: https://ethereal.email/messages
6. Click magic link in email
7. ✅ Verify redirect to /dashboard
8. ✅ Verify user name/email displayed

**Test 1.2: Session Persistence**
1. Refresh page (F5)
2. ✅ Verify still logged in (no redirect to signin)
3. Open DevTools → Application → Cookies
4. ✅ Verify `authjs.session-token` cookie exists

**Test 1.3: Sign Out**
1. Click user menu → "Sign Out"
2. ✅ Verify redirect to /auth/signin
3. ✅ Verify session cookie deleted

**Test 1.4: Protected Routes**
1. While signed out, try to visit http://localhost:3000/dashboard
2. ✅ Verify automatic redirect to /auth/signin

---

### Phase 2: Workspace Management (10 minutes)

**Test 2.1: Create Workspace**
1. Sign in again
2. Navigate to /dashboard/workspaces
3. Click "Create Workspace"
4. Enter name: "Test Workspace"
5. Enter description: "For testing purposes"
6. Click "Create"
7. ✅ Verify workspace appears in list
8. ✅ Verify redirect to workspace page

**Test 2.2: Workspace Branding (M1 Feature)**
1. In workspace settings, find "Branding" section
2. Upload logo image (PNG/JPG)
3. ✅ Verify logo preview shows
4. Select theme color (e.g., #FF5733)
5. ✅ Verify color picker works
6. Click "Save Branding"
7. ✅ Verify success message
8. Navigate to workspace home
9. ✅ Verify logo displayed
10. ✅ Verify theme color applied to UI elements

**Test 2.3: Member Management**
1. Go to workspace → Members
2. Click "Invite Member"
3. Enter email + select role (EDITOR)
4. ✅ Verify invitation sent (check Ethereal)
5. ✅ Verify member appears as "Pending"

---

### Phase 3: Question Creation (20 minutes)

**Test all 18 question types:**

**3.1 Standard Questions**

**MCQ (Multiple Choice):**
1. Navigate to /workspaces/:id/questions
2. Click "Create Question"
3. Select type: "Multiple Choice"
4. Enter title: "What is 2+2?"
5. Enter prompt: "Select the correct answer"
6. Add 4 options:
   - "3" (incorrect)
   - "4" (correct) ✓
   - "5" (incorrect)
   - "22" (incorrect)
7. Mark correct answer
8. Click "Save"
9. ✅ Verify question appears in list

**TRUE_FALSE:**
1. Create new question
2. Type: "True/False"
3. Title: "The Earth is flat"
4. Prompt: "Is this statement true?"
5. Correct answer: "False"
6. Save
7. ✅ Verify in list

**OPEN (Text Input):**
1. Create new question
2. Type: "Open Text"
3. Title: "Capital of France"
4. Prompt: "What is the capital of France?"
5. Correct answer: "Paris"
6. Save
7. ✅ Verify in list

**ORDERING:**
1. Create new question
2. Type: "Ordering"
3. Title: "Arrange by size"
4. Add 4 items: "Elephant", "Mouse", "Cat", "Dog"
5. Set correct order
6. Save
7. ✅ Verify in list

**3.2 Photo-Based Questions**

**PHOTO_GUESS:**
1. Create new question
2. Type: "Photo Guess"
3. Title: "Identify this landmark"
4. Upload image (or use URL)
5. Correct answer: "Eiffel Tower"
6. Save
7. ✅ Verify image preview shows

**PHOTO_ZOOM_REVEAL:**
1. Create with zoomed-in image
2. Progressive zoom-out mechanic
3. ✅ Verify image upload works

**PHOTO_TIMELINE:**
1. Create with multiple images
2. Add dates to each
3. ✅ Verify chronological ordering

**3.3 Music Questions (Spotify Integration)**

**Connect Spotify First:**
1. In question form, click "Connect Spotify"
2. ✅ Verify redirect to Spotify OAuth
3. Authorize app
4. ✅ Verify redirect back with "Connected" status

**MUSIC_GUESS_TITLE:**
1. Create new question
2. Type: "Music - Guess Title"
3. Click "Search Spotify"
4. Search for "Bohemian Rhapsody"
5. Select track from results
6. ✅ Verify preview plays (30 seconds)
7. ✅ Verify track data saved (title, artist, album)
8. Save question
9. ✅ Verify in list with Spotify icon

**MUSIC_GUESS_ARTIST:**
1. Similar to above, but answer is artist name
2. ✅ Verify works

**MUSIC_GUESS_YEAR:**
1. Question: "When was this released?"
2. ✅ Verify year extracted from Spotify data

**3.4 Video Questions (YouTube Integration)**

**YOUTUBE_SCENE_QUESTION:**
1. Create new question
2. Type: "YouTube - Scene Question"
3. Paste YouTube URL: `https://youtube.com/watch?v=dQw4w9WgXcQ`
4. ✅ Verify video metadata fetched (title, thumbnail)
5. Enter question about the scene
6. Set correct answer
7. Save
8. ✅ Verify in list with video thumbnail

**YOUTUBE_NEXT_LINE:**
1. Create with YouTube video
2. Question: "What's the next line?"
3. ✅ Verify works

**3.5 Social/Party Questions**

**POLL:**
1. Create new question
2. Type: "Poll"
3. Title: "Favorite color?"
4. Add options: Red, Blue, Green, Yellow
5. No correct answer (it's a poll)
6. Save
7. ✅ Verify in list

**EMOJI_VOTE:**
1. Create with emoji options
2. ✅ Verify emoji picker works

**CHAOS_EVENT:**
1. Create special event question
2. Random point distribution
3. ✅ Verify saves

---

### Phase 4: Export/Import Questions (M3 Feature - 5 minutes)

**Test 4.1: Export Questions**
1. Navigate to /workspaces/:id/questions
2. Select 5 questions (checkboxes)
3. Click "Export" button
4. ✅ Verify JSON file downloads
5. Open JSON file
6. ✅ Verify structure:
   ```json
   {
     "version": "1.0",
     "exportedAt": "2026-01-31T...",
     "workspace": { "id": "...", "name": "..." },
     "count": 5,
     "questions": [...]
   }
   ```

**Test 4.2: Import Questions**
1. Click "Import" button
2. Select exported JSON file
3. ✅ Verify upload progress
4. ✅ Verify success message: "Imported X questions, skipped Y duplicates"
5. Check questions list
6. ✅ Verify imported questions appear
7. Try importing same file again
8. ✅ Verify duplicate detection works (skips existing)

---

### Phase 5: Quiz Builder (15 minutes)

**Test 5.1: Create Quiz from Scratch**
1. Navigate to /workspaces/:id/quizzes
2. Click "Create Quiz"
3. Enter title: "Test Quiz"
4. Enter description: "For testing"
5. Click "Create"
6. ✅ Verify redirect to quiz builder

**Test 5.2: Add Rounds**
1. Click "Add Round"
2. Enter round title: "Round 1: General Knowledge"
3. ✅ Verify round appears
4. Add second round: "Round 2: Music"
5. ✅ Verify 2 rounds visible

**Test 5.3: Add Questions to Rounds**
1. In Round 1, click "Add Item"
2. Select "Question"
3. Search for question by title
4. Select a question
5. ✅ Verify question added to round
6. Add 3 more questions to Round 1
7. Add 3 questions to Round 2
8. ✅ Verify quiz structure correct

**Test 5.4: Drag & Drop Reordering**
1. Drag Round 2 above Round 1
2. ✅ Verify order changes
3. ✅ Verify save indicator shows
4. Drag questions within a round
5. ✅ Verify item order changes
6. Refresh page (F5)
7. ✅ Verify order persisted

**Test 5.5: Add Minigame**
1. In a round, click "Add Item"
2. Select "Minigame"
3. Choose "Swan Race"
4. ✅ Verify minigame item added
5. ✅ Verify different icon/styling from questions

**Test 5.6: Quiz Preview**
1. Click "Preview" button
2. ✅ Verify all rounds/items visible
3. ✅ Verify correct order
4. ✅ Verify question details shown

---

### Phase 6: Quiz Templates (M2 Feature - 5 minutes)

**Test 6.1: List Templates**
1. Navigate to /workspaces/:id/templates
2. ✅ Verify 3 seeded templates appear:
   - General Knowledge Quiz
   - Music Quiz (Spotify)
   - Photo Quiz
3. ✅ Verify template badge/tag visible

**Test 6.2: Use Template**
1. Click "Use Template" on "General Knowledge Quiz"
2. Enter new quiz name: "My Quiz from Template"
3. Click "Create"
4. ✅ Verify quiz created
5. Navigate to quiz builder
6. ✅ Verify all rounds copied
7. ✅ Verify all questions copied
8. Edit quiz (add/remove items)
9. Go back to templates
10. ✅ Verify original template unchanged (independence)

**Test 6.3: Create Custom Template**
1. Create a new quiz
2. Build it with rounds + questions
3. In quiz settings, toggle "Is Template"
4. Save
5. Navigate to templates
6. ✅ Verify new template appears

---

### Phase 7: Live Session Flow (30 minutes - CRITICAL)

**Test 7.1: Create Session**
1. Navigate to /workspaces/:id/sessions
2. Click "Create Session"
3. Select a quiz (e.g., "Test Quiz")
4. Click "Create"
5. ✅ Verify session created
6. ✅ Verify 6-character code generated (e.g., "ABC123")
7. ✅ Verify status: "WAITING"
8. ✅ Verify QR code displayed

**Test 7.2: Player Join**
1. Open new browser/incognito window
2. Navigate to http://localhost:3000/play
3. Enter session code (ABC123)
4. Click "Join"
5. Enter player name: "Test Player"
6. Select avatar
7. Click "Join Session"
8. ✅ Verify redirect to lobby
9. ✅ Verify workspace branding applied (logo, color)

**In host view:**
10. ✅ Verify player appears in player list
11. ✅ Verify player count updated (1 player)
12. ✅ Verify connection status: "Online"

**Add more players:**
13. Open 2 more browser windows
14. Repeat join process
15. ✅ Verify all 3 players visible in host view

**Test 7.3: Start Session**
1. In host view, click "Start Session"
2. ✅ Verify status changes to "ACTIVE"
3. ✅ Verify player screens update (show waiting)
4. ✅ Verify first question ready to start

**Test 7.4: Question Flow**

**Host Actions:**
1. Click "Start Item" on first question
2. ✅ Verify countdown starts (30s default)

**Player Actions:**
3. In player window, verify question appears
4. ✅ Verify question text visible
5. ✅ Verify answer options displayed
6. ✅ Verify countdown timer shown
7. Select an answer (click option)
8. ✅ Verify feedback: "Answer submitted"
9. ✅ Verify can't change answer after submit

**Host View:**
10. ✅ Verify answer count updates: "1/3 answered"
11. Wait for all players to answer
12. Click "Lock Item"
13. ✅ Verify timer stops
14. ✅ Verify late players can't submit

**Reveal:**
15. Click "Reveal Answers"
16. ✅ Verify correct answer highlighted
17. ✅ Verify player scores updated

**Player View:**
18. ✅ Verify correct answer shown
19. ✅ Verify own answer marked (correct/incorrect)
20. ✅ Verify points awarded displayed

**Leaderboard:**
21. ✅ Verify leaderboard appears
22. ✅ Verify players sorted by score
23. ✅ Verify rank displayed (1st, 2nd, 3rd)

**Test 7.5: Next Question**
1. Host clicks "Next Item"
2. Repeat question flow steps
3. ✅ Verify scores carry over
4. Complete 3-4 questions

**Test 7.6: Swan Race Minigame**
1. Navigate to Swan Race item
2. Host clicks "Start Swan Race"
3. ✅ Verify countdown: "3... 2... 1... GO!"

**Player View:**
4. ✅ Verify race track displayed
5. ✅ Verify own swan visible
6. Tap spacebar rapidly
7. ✅ Verify swan moves forward
8. ✅ Verify position updates in real-time (60 FPS)

**Host View:**
9. ✅ Verify all swans visible on track
10. ✅ Verify real-time position updates
11. ✅ Verify finish line detection
12. ✅ Verify final rankings correct

**Test 7.7: Pause/Resume**
1. During active question, click "Pause Session"
2. ✅ Verify timer stops
3. ✅ Verify players see "Session Paused" screen
4. ✅ Verify can't submit answers
5. Click "Resume Session"
6. ✅ Verify timer resumes
7. ✅ Verify players can answer again

**Test 7.8: End Session**
1. After final question, click "End Session"
2. ✅ Verify status changes to "ENDED"
3. ✅ Verify final leaderboard shown to all players
4. ✅ Verify top 3 highlighted with animations

**Host View:**
5. ✅ Verify session controls disabled
6. ✅ Verify "Export CSV" button appears

---

### Phase 8: Results Export (M4 Feature - 5 minutes)

**Test 8.1: Export Session Results**
1. In ended session view, click "Export CSV" button
2. ✅ Verify CSV file downloads
3. Open CSV in Excel/Numbers
4. ✅ Verify columns:
   - Player Name
   - Total Score
   - Q1 (Round Name)
   - Q1 Correct (✓/✗)
   - Q1 Points
   - Q2 ...
5. ✅ Verify all players' answers included
6. ✅ Verify scores correct
7. ✅ Verify round names shown

**Test 8.2: File Naming**
1. Check downloaded filename
2. ✅ Verify format: `session-results-ABC123-2026-01-31.csv`
3. ✅ Verify session code included
4. ✅ Verify date included

---

### Phase 9: Real-Time Testing (10 minutes)

**Test 9.1: WebSocket Connection**
1. Create new session
2. Join as player
3. Open DevTools → Network → WS
4. ✅ Verify WebSocket connection established: `ws://localhost:3001`
5. ✅ Verify connection status: "101 Switching Protocols"

**Test 9.2: Player Join Event**
1. With DevTools WS tab open
2. Join as second player
3. ✅ Verify `PLAYER_JOINED` event received
4. ✅ Verify player data in payload

**Test 9.3: Answer Submission**
1. Start question
2. Submit answer as player
3. ✅ Verify `SUBMIT_ANSWER` event sent
4. ✅ Verify `ANSWER_RECEIVED` event received
5. ✅ Verify host sees answer count update instantly

**Test 9.4: Leaderboard Update**
1. Reveal answers
2. ✅ Verify `LEADERBOARD_UPDATE` event sent
3. ✅ Verify all players receive update
4. ✅ Verify rankings update simultaneously

**Test 9.5: Disconnection Handling**
1. Join as player
2. Close browser tab (simulate disconnect)
3. ✅ Verify host sees player status: "Disconnected"
4. Rejoin with same name
5. ✅ Verify reconnection detected
6. ✅ Verify status back to "Online"

---

### Phase 10: Media Uploads (5 minutes)

**Test 10.1: Image Upload**
1. Navigate to /workspaces/:id/assets
2. Click "Upload"
3. Drag & drop image file (PNG/JPG)
4. ✅ Verify upload progress bar
5. ✅ Verify asset appears in list
6. ✅ Verify thumbnail generated
7. Click asset to view
8. ✅ Verify full image loads

**Test 10.2: Delete Asset**
1. Select asset
2. Click "Delete"
3. Confirm deletion
4. ✅ Verify asset removed from list
5. ✅ Verify file removed from S3

---

### Phase 11: Mobile Responsiveness (10 minutes)

**Test 11.1: Mobile Player Experience**
1. Open player app on mobile device (or DevTools → Toggle Device Toolbar)
2. Set viewport: iPhone 12 (390x844)
3. Join session
4. ✅ Verify touch-friendly buttons (min 44px)
5. ✅ Verify readable text (min 16px)
6. ✅ Verify no horizontal scroll
7. Answer questions
8. ✅ Verify tap targets easy to hit
9. ✅ Verify animations smooth

**Test 11.2: Tablet Host View**
1. Open host view on tablet (or DevTools iPad)
2. ✅ Verify layout adapts (no overflow)
3. ✅ Verify controls accessible
4. ✅ Verify player list readable

**Test 11.3: Landscape Orientation**
1. Rotate device to landscape
2. ✅ Verify layout adjusts
3. ✅ Verify no content clipped

---

### Phase 12: Accessibility (10 minutes)

**Test 12.1: Keyboard Navigation**
1. Close mouse/trackpad
2. Use Tab key to navigate
3. ✅ Verify logical tab order
4. ✅ Verify focus indicators visible (blue ring)
5. Press Enter on buttons
6. ✅ Verify actions trigger correctly
7. Press Esc to close modals
8. ✅ Verify modals close

**Test 12.2: Screen Reader (VoiceOver/NVDA)**
1. Enable screen reader
2. Navigate through app
3. ✅ Verify all interactive elements announced
4. ✅ Verify button labels descriptive
5. ✅ Verify form labels present
6. ✅ Verify landmark regions defined

**Test 12.3: Color Contrast**
1. Use DevTools → Lighthouse
2. Run accessibility audit
3. ✅ Verify color contrast ≥ 4.5:1
4. ✅ Verify no contrast violations

---

## Performance Testing

### Test 13: Load Testing (Optional - Advanced)

**Test 13.1: Multiple Concurrent Sessions**
1. Create 5 sessions simultaneously
2. Join each with 10 players (50 players total)
3. ✅ Verify all sessions responsive
4. ✅ Verify WebSocket messages delivered
5. ✅ Verify no lag in UI

**Test 13.2: Large Quiz**
1. Create quiz with 50 questions
2. Test complete session flow
3. ✅ Verify load times acceptable
4. ✅ Verify no memory leaks (DevTools → Memory)

**Test 13.3: API Response Times**
1. Open DevTools → Network
2. Perform various actions
3. ✅ Verify API calls < 200ms
4. ✅ Verify no failed requests

---

## Verification Checklist

After completing all tests, verify:

- [ ] ✅ Authentication flow works (magic link → dashboard → sign out)
- [ ] ✅ Workspaces created and branding applied (M1)
- [ ] ✅ All 18 question types created successfully
- [ ] ✅ Quiz builder drag & drop functional
- [ ] ✅ Templates list and "Use Template" works (M2)
- [ ] ✅ Export/Import questions functional (M3)
- [ ] ✅ Complete live session flow tested (join → answer → reveal → end)
- [ ] ✅ Swan Race minigame works (60 FPS)
- [ ] ✅ Session results CSV export works (M4)
- [ ] ✅ WebSocket real-time updates functional
- [ ] ✅ Spotify integration works (OAuth + search)
- [ ] ✅ YouTube integration works (embed + play)
- [ ] ✅ Media uploads to S3 work
- [ ] ✅ Mobile responsive on iPhone/Android
- [ ] ✅ Keyboard navigation accessible
- [ ] ✅ Screen reader compatible

---

## Bug Tracking

**If you find issues during testing:**

1. Document in GitHub Issues with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots/video
   - Browser/device info
   - Console errors

2. Priority levels:
   - **Critical:** Blocks main user flow (e.g., can't create session)
   - **High:** Important feature broken (e.g., answers not saving)
   - **Medium:** Minor issue (e.g., layout glitch)
   - **Low:** Nice to have (e.g., animation polish)

---

## Next Steps After Testing

Once all tests pass:

1. **Fix any critical/high priority bugs**
2. **Update documentation** with any changes
3. **Proceed to production deployment** (see DEPLOYMENT_ARCHITECTURE.md)
4. **Setup monitoring** (Sentry, Uptime Robot)
5. **Perform load testing** on production
6. **Soft launch** with beta users
7. **Public launch** 🚀

---

**Good luck with testing!** 🎉

If you need help with any test, refer to:
- PLATFORM_AUDIT_REPORT.md (technical details)
- API.md (endpoint documentation)
- DEPLOYMENT_ARCHITECTURE.md (deployment guide)
