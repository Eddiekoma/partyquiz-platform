# PartyQuiz Platform API Documentation

**Version**: 1.0  
**Base URL**: `https://partyquiz-platform.databridge360.com`  
**WebSocket URL**: `wss://partyquiz-platform.databridge360.com/ws`

---

## Table of Contents

1. [Authentication](#authentication)
2. [REST API Endpoints](#rest-api-endpoints)
   - [Health & Status](#health--status)
   - [Workspaces](#workspaces)
   - [Workspace Members](#workspace-members)
   - [Questions](#questions)
   - [Quizzes](#quizzes)
   - [Quiz Templates](#quiz-templates)
   - [Live Sessions](#live-sessions)
   - [Media & Assets](#media--assets)
   - [Integrations](#integrations)
3. [WebSocket Protocol](#websocket-protocol)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Authentication

PartyQuiz uses **NextAuth.js** with magic link authentication.

### Magic Link Flow

```http
POST /api/auth/signin/email
Content-Type: application/json

{
  "email": "user@example.com",
  "callbackUrl": "/dashboard"
}
```

**Response**: 200 OK
```json
{
  "url": "/auth/verify-request"
}
```

User receives an email with a magic link. Clicking it authenticates the session.

### Session Management

Sessions are managed via HTTP-only cookies. Include cookies in all authenticated requests.

**Check current session:**
```http
GET /api/auth/session
```

**Response**: 200 OK
```json
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": null
  },
  "expires": "2026-02-28T12:00:00.000Z"
}
```

**Sign out:**
```http
POST /api/auth/signout
```

---

## REST API Endpoints

### Health & Status

#### GET /api/healthz

Health check endpoint for monitoring.

**Response**: 200 OK
```json
{
  "status": "ok",
  "timestamp": 1738368000000,
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

### Workspaces

#### GET /api/workspaces

List all workspaces the authenticated user has access to.

**Authentication**: Required

**Response**: 200 OK
```json
{
  "workspaces": [
    {
      "id": "ws_abc123",
      "name": "My Quiz Workspace",
      "slug": "my-quiz-workspace",
      "logo": "https://storage.example.com/logos/abc123.png",
      "themeColor": "#3B82F6",
      "role": "OWNER",
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/workspaces

Create a new workspace.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "New Workspace",
  "slug": "new-workspace"
}
```

**Response**: 201 Created
```json
{
  "workspace": {
    "id": "ws_xyz789",
    "name": "New Workspace",
    "slug": "new-workspace",
    "ownerId": "user_abc123",
    "logo": null,
    "themeColor": null,
    "createdAt": "2026-01-31T12:00:00.000Z"
  }
}
```

#### GET /api/workspaces/[id]

Get workspace details.

**Authentication**: Required  
**Permission**: Workspace member

**Response**: 200 OK
```json
{
  "id": "ws_abc123",
  "name": "My Quiz Workspace",
  "slug": "my-quiz-workspace",
  "ownerId": "user_abc123",
  "logo": "https://storage.example.com/logos/abc123.png",
  "themeColor": "#3B82F6",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "memberCount": 5,
  "questionCount": 120,
  "quizCount": 15
}
```

#### PATCH /api/workspaces/[id]

Update workspace details.

**Authentication**: Required  
**Permission**: `WORKSPACE_UPDATE` (OWNER, ADMIN)

**Request Body**:
```json
{
  "name": "Updated Workspace Name",
  "logo": "https://storage.example.com/logos/new.png",
  "themeColor": "#8B5CF6"
}
```

**Response**: 200 OK

#### DELETE /api/workspaces/[id]

Delete a workspace.

**Authentication**: Required  
**Permission**: `WORKSPACE_DELETE` (OWNER only)

**Response**: 200 OK

#### GET /api/workspaces/[id]/branding

Get workspace branding (logo + theme color).

**Authentication**: Required  
**Permission**: Workspace member

**Response**: 200 OK
```json
{
  "logo": "https://storage.example.com/logos/abc123.png",
  "themeColor": "#3B82F6"
}
```

#### PATCH /api/workspaces/[id]/branding

Update workspace branding.

**Authentication**: Required  
**Permission**: `WORKSPACE_UPDATE`

**Request Body**:
```json
{
  "logo": "https://storage.example.com/logos/new.png",
  "themeColor": "#EC4899"
}
```

**Response**: 200 OK

#### GET /api/workspaces/[id]/branding/public

Get public branding (no authentication required). Used by player join page.

**Response**: 200 OK
```json
{
  "logo": "https://storage.example.com/logos/abc123.png",
  "themeColor": "#3B82F6"
}
```

---

### Workspace Members

#### GET /api/workspaces/[id]/members

List workspace members.

**Authentication**: Required  
**Permission**: Workspace member

**Response**: 200 OK
```json
{
  "members": [
    {
      "id": "member_123",
      "userId": "user_abc123",
      "role": "OWNER",
      "user": {
        "id": "user_abc123",
        "email": "owner@example.com",
        "name": "John Doe"
      },
      "joinedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "member_456",
      "userId": "user_def456",
      "role": "EDITOR",
      "user": {
        "id": "user_def456",
        "email": "editor@example.com",
        "name": "Jane Smith"
      },
      "joinedAt": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

#### PATCH /api/workspaces/[id]/members/[userId]

Update member role.

**Authentication**: Required  
**Permission**: `MEMBER_UPDATE` (OWNER, ADMIN)

**Request Body**:
```json
{
  "role": "ADMIN"
}
```

**Response**: 200 OK

#### DELETE /api/workspaces/[id]/members/[userId]

Remove a member from workspace.

**Authentication**: Required  
**Permission**: `MEMBER_REMOVE` (OWNER, ADMIN)

**Response**: 200 OK

---

### Questions

#### GET /api/workspaces/[id]/questions

List questions in a workspace.

**Authentication**: Required  
**Permission**: `QUESTION_VIEW`

**Query Parameters**:
- `type` (optional): Filter by question type (MCQ, TRUE_FALSE, etc.)
- `status` (optional): Filter by status (DRAFT, PUBLISHED, ARCHIVED)
- `search` (optional): Search in title/prompt
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```http
GET /api/workspaces/ws_abc123/questions?type=MCQ&status=PUBLISHED&limit=20
```

**Response**: 200 OK
```json
{
  "questions": [
    {
      "id": "q_xyz789",
      "workspaceId": "ws_abc123",
      "type": "MCQ",
      "title": "Capital of France",
      "prompt": "What is the capital city of France?",
      "explanation": "Paris has been the capital since the 10th century.",
      "difficulty": 2,
      "tags": ["geography", "europe"],
      "status": "PUBLISHED",
      "options": [
        { "id": "opt_1", "text": "London", "isCorrect": false, "order": 0 },
        { "id": "opt_2", "text": "Paris", "isCorrect": true, "order": 1 },
        { "id": "opt_3", "text": "Berlin", "isCorrect": false, "order": 2 },
        { "id": "opt_4", "text": "Madrid", "isCorrect": false, "order": 3 }
      ],
      "media": [],
      "createdBy": "user_abc123",
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z"
    }
  ],
  "total": 120,
  "limit": 20,
  "offset": 0
}
```

#### POST /api/workspaces/[id]/questions

Create a new question.

**Authentication**: Required  
**Permission**: `QUESTION_CREATE`

**Request Body**:
```json
{
  "type": "MCQ",
  "title": "Programming Languages",
  "prompt": "Which language is primarily used for web frontend?",
  "explanation": "JavaScript is the standard language for client-side web development.",
  "difficulty": 3,
  "tags": ["programming", "web"],
  "status": "PUBLISHED",
  "options": [
    { "text": "Python", "isCorrect": false },
    { "text": "JavaScript", "isCorrect": true },
    { "text": "C++", "isCorrect": false },
    { "text": "Java", "isCorrect": false }
  ],
  "media": []
}
```

**Response**: 201 Created
```json
{
  "question": {
    "id": "q_new123",
    "workspaceId": "ws_abc123",
    "type": "MCQ",
    "title": "Programming Languages",
    "prompt": "Which language is primarily used for web frontend?",
    "explanation": "JavaScript is the standard language for client-side web development.",
    "difficulty": 3,
    "tags": ["programming", "web"],
    "status": "PUBLISHED",
    "options": [...],
    "media": [],
    "createdBy": "user_abc123",
    "createdAt": "2026-01-31T12:00:00.000Z"
  }
}
```

#### GET /api/workspaces/[id]/questions/[questionId]

Get a specific question with full details.

**Authentication**: Required  
**Permission**: `QUESTION_VIEW`

**Response**: 200 OK (same structure as POST response)

#### PATCH /api/workspaces/[id]/questions/[questionId]

Update a question.

**Authentication**: Required  
**Permission**: `QUESTION_UPDATE`

**Request Body**: (partial update supported)
```json
{
  "title": "Updated Title",
  "difficulty": 4,
  "status": "PUBLISHED"
}
```

**Response**: 200 OK

#### DELETE /api/workspaces/[id]/questions/[questionId]

Delete a question.

**Authentication**: Required  
**Permission**: `QUESTION_DELETE`

**Response**: 200 OK

#### POST /api/workspaces/[id]/questions/export

Export questions as JSON file.

**Authentication**: Required  
**Permission**: `QUESTION_VIEW`

**Request Body**:
```json
{
  "questionIds": ["q_123", "q_456"]
}
```

If `questionIds` is omitted or empty, exports all workspace questions.

**Response**: 200 OK (application/json download)
```json
{
  "version": "1.0",
  "exportedAt": "2026-01-31T12:00:00.000Z",
  "exportedBy": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "workspace": {
    "id": "ws_abc123",
    "name": "My Workspace"
  },
  "count": 2,
  "questions": [
    {
      "type": "MCQ",
      "title": "Question Title",
      "prompt": "Question prompt",
      "explanation": "Explanation text",
      "difficulty": 3,
      "tags": ["tag1", "tag2"],
      "status": "PUBLISHED",
      "options": [
        { "text": "Option 1", "isCorrect": false, "order": 0 },
        { "text": "Option 2", "isCorrect": true, "order": 1 }
      ],
      "media": []
    }
  ]
}
```

Filename: `questions-export-{workspace}-{date}.json`

#### POST /api/workspaces/[id]/questions/import

Import questions from JSON file.

**Authentication**: Required  
**Permission**: `QUESTION_CREATE`

**Request Body**:
```json
{
  "data": {
    "version": "1.0",
    "questions": [...]
  },
  "options": {
    "skipDuplicates": true
  }
}
```

**Response**: 200 OK
```json
{
  "imported": 15,
  "skipped": 3,
  "errors": [
    {
      "question": "Question Title",
      "error": "Invalid question type"
    }
  ],
  "message": "Successfully imported 15 questions, skipped 3 duplicates"
}
```

---

### Quizzes

#### GET /api/workspaces/[id]/quizzes

List quizzes in a workspace.

**Authentication**: Required  
**Permission**: `QUIZ_VIEW`

**Query Parameters**:
- `isTemplate` (optional): Filter templates (true/false)
- `search` (optional): Search in title/description
- `limit`, `offset`: Pagination

**Response**: 200 OK
```json
{
  "quizzes": [
    {
      "id": "quiz_abc123",
      "workspaceId": "ws_abc123",
      "title": "General Knowledge Quiz",
      "description": "Test your trivia skills!",
      "isTemplate": false,
      "rounds": [
        {
          "id": "round_1",
          "title": "Round 1: History",
          "order": 0,
          "items": [
            {
              "id": "item_1",
              "type": "QUESTION",
              "questionId": "q_xyz789",
              "order": 0
            }
          ]
        }
      ],
      "createdBy": "user_abc123",
      "createdAt": "2026-01-25T10:00:00.000Z"
    }
  ],
  "total": 15
}
```

#### POST /api/workspaces/[id]/quizzes

Create a new quiz.

**Authentication**: Required  
**Permission**: `QUIZ_CREATE`

**Request Body**:
```json
{
  "title": "Movie Night Quiz",
  "description": "Test your movie knowledge",
  "isTemplate": false,
  "rounds": [
    {
      "title": "Round 1: Classics",
      "items": [
        { "type": "QUESTION", "questionId": "q_123" },
        { "type": "QUESTION", "questionId": "q_456" }
      ]
    }
  ]
}
```

**Response**: 201 Created

#### GET /api/workspaces/[id]/quizzes/[quizId]

Get full quiz details with all rounds and items.

**Authentication**: Required  
**Permission**: `QUIZ_VIEW`

**Response**: 200 OK (full quiz structure)

#### PATCH /api/workspaces/[id]/quizzes/[quizId]

Update quiz metadata or structure.

**Authentication**: Required  
**Permission**: `QUIZ_UPDATE`

**Request Body**: (partial update)
```json
{
  "title": "Updated Quiz Title",
  "description": "New description"
}
```

**Response**: 200 OK

#### DELETE /api/workspaces/[id]/quizzes/[quizId]

Delete a quiz.

**Authentication**: Required  
**Permission**: `QUIZ_DELETE`

**Response**: 200 OK

---

### Quiz Templates

#### GET /api/workspaces/[id]/templates

List available quiz templates.

**Authentication**: Required  
**Permission**: Workspace member

**Response**: 200 OK
```json
{
  "templates": [
    {
      "id": "quiz_tpl_birthday",
      "title": "🎉 Birthday Party Quiz",
      "description": "Fun questions for birthday celebrations",
      "isTemplate": true,
      "rounds": [...],
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "quiz_tpl_corporate",
      "title": "🏢 Corporate Team Building",
      "description": "Professional quiz for company events",
      "isTemplate": true,
      "rounds": [...],
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/workspaces/[id]/templates

Create a quiz from a template.

**Authentication**: Required  
**Permission**: `QUIZ_CREATE`

**Request Body**:
```json
{
  "templateId": "quiz_tpl_birthday",
  "title": "John's Birthday Quiz"
}
```

**Response**: 201 Created
```json
{
  "quiz": {
    "id": "quiz_new123",
    "title": "John's Birthday Quiz",
    "isTemplate": false,
    "rounds": [...]
  }
}
```

---

### Live Sessions

#### GET /api/workspaces/[id]/sessions

List live sessions in a workspace.

**Authentication**: Required  
**Permission**: `SESSION_VIEW_RESULTS`

**Query Parameters**:
- `status` (optional): Filter by status (LOBBY, ACTIVE, ENDED)
- `limit`, `offset`: Pagination

**Response**: 200 OK
```json
{
  "sessions": [
    {
      "id": "session_abc123",
      "workspaceId": "ws_abc123",
      "quizId": "quiz_xyz789",
      "code": "ABC123",
      "status": "ACTIVE",
      "hostUserId": "user_abc123",
      "playerCount": 15,
      "startedAt": "2026-01-31T19:00:00.000Z",
      "endedAt": null
    }
  ]
}
```

#### POST /api/workspaces/[id]/sessions

Create a new live session.

**Authentication**: Required  
**Permission**: `SESSION_CREATE`

**Request Body**:
```json
{
  "quizId": "quiz_xyz789"
}
```

**Response**: 201 Created
```json
{
  "session": {
    "id": "session_new123",
    "workspaceId": "ws_abc123",
    "quizId": "quiz_xyz789",
    "code": "XYZ789",
    "status": "LOBBY",
    "hostUserId": "user_abc123",
    "startedAt": "2026-01-31T19:00:00.000Z"
  }
}
```

#### GET /api/workspaces/[id]/sessions/[sessionId]

Get session details with players and answers.

**Authentication**: Required  
**Permission**: `SESSION_VIEW_RESULTS`

**Response**: 200 OK
```json
{
  "id": "session_abc123",
  "code": "ABC123",
  "status": "ACTIVE",
  "quiz": {
    "id": "quiz_xyz789",
    "title": "General Knowledge"
  },
  "players": [
    {
      "id": "player_1",
      "name": "Alice",
      "avatar": "🦄",
      "score": 150,
      "joinedAt": "2026-01-31T19:05:00.000Z"
    }
  ],
  "answerCount": 45,
  "startedAt": "2026-01-31T19:00:00.000Z"
}
```

#### PUT /api/workspaces/[id]/sessions/[sessionId]

Update session status.

**Authentication**: Required  
**Permission**: `SESSION_UPDATE`

**Request Body**:
```json
{
  "status": "ACTIVE"
}
```

**Response**: 200 OK

#### DELETE /api/workspaces/[id]/sessions/[sessionId]

Delete a session.

**Authentication**: Required  
**Permission**: `SESSION_DELETE`

**Response**: 200 OK

#### GET /api/sessions/[id]/export?format=csv

Export session results as CSV.

**Authentication**: Required  
**Permission**: `SESSION_VIEW_RESULTS`

**Query Parameters**:
- `format`: Must be "csv"

**Response**: 200 OK (text/csv download)

CSV Format:
```csv
Player Name,Total Score,Q1 (Round 1),Q1 Correct,Q1 Points,Q2 (Round 1),Q2 Correct,Q2 Points
"Alice",150,"Paris",✓,10,"Shakespeare",✓,10
"Bob",120,"London",✗,0,"Hemingway",✓,10
```

Filename: `session-results-{code}-{date}.csv`

---

### Media & Assets

#### GET /api/workspaces/[id]/assets

List uploaded media assets.

**Authentication**: Required  
**Permission**: `ASSET_VIEW`

**Query Parameters**:
- `type` (optional): Filter by type (IMAGE, AUDIO, VIDEO, OTHER)
- `search` (optional): Search in filename
- `limit`, `offset`: Pagination

**Response**: 200 OK
```json
{
  "assets": [
    {
      "id": "asset_abc123",
      "workspaceId": "ws_abc123",
      "filename": "party-photo.jpg",
      "type": "IMAGE",
      "size": 245678,
      "url": "https://storage.example.com/assets/abc123.jpg",
      "uploadedBy": "user_abc123",
      "uploadedAt": "2026-01-28T14:00:00.000Z"
    }
  ],
  "total": 45
}
```

#### POST /api/media/upload

Upload a media file.

**Authentication**: Required

**Request**: Multipart form data
- `file`: File to upload
- `workspaceId`: Target workspace ID
- `type`: Asset type (IMAGE, AUDIO, VIDEO, OTHER)

**Response**: 200 OK
```json
{
  "asset": {
    "id": "asset_new123",
    "filename": "photo.jpg",
    "type": "IMAGE",
    "size": 123456,
    "url": "https://storage.example.com/assets/new123.jpg"
  }
}
```

#### GET /api/workspaces/[id]/assets/[assetId]

Get asset details.

**Authentication**: Required  
**Permission**: `ASSET_VIEW`

**Response**: 200 OK

#### DELETE /api/workspaces/[id]/assets/[assetId]

Delete an asset.

**Authentication**: Required  
**Permission**: `ASSET_DELETE`

**Response**: 200 OK

---

### Integrations

#### Spotify

##### GET /api/spotify/auth

Initiate Spotify OAuth flow.

**Authentication**: Required

**Response**: 302 Redirect to Spotify authorization

##### GET /api/spotify/callback

Spotify OAuth callback (handled automatically).

##### GET /api/spotify/search

Search Spotify tracks.

**Authentication**: Required

**Query Parameters**:
- `q`: Search query
- `limit`: Results limit (default: 20)

**Response**: 200 OK
```json
{
  "tracks": [
    {
      "id": "spotify_track_123",
      "name": "Bohemian Rhapsody",
      "artists": ["Queen"],
      "album": "A Night at the Opera",
      "releaseDate": "1975-10-31",
      "durationMs": 354000,
      "albumArt": "https://i.scdn.co/image/..."
    }
  ]
}
```

#### YouTube

##### GET /api/youtube/validate

Validate a YouTube video ID.

**Authentication**: Required

**Query Parameters**:
- `videoId`: YouTube video ID

**Response**: 200 OK
```json
{
  "valid": true,
  "video": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "channelTitle": "Rick Astley",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "duration": "PT3M33S"
  }
}
```

---

## WebSocket Protocol

Connect to the WebSocket server for real-time game updates.

**Connection URL**: `wss://partyquiz-platform.databridge360.com/ws`

### Connection Flow

1. **Client connects** to WebSocket server
2. **Client sends JOIN_SESSION** message with session code and player info
3. **Server acknowledges** with SESSION_STATE
4. **Real-time events** flow bidirectionally

### Message Format

All WebSocket messages follow this structure:

```typescript
{
  "type": "MESSAGE_TYPE",
  "payload": { /* type-specific data */ },
  "timestamp": 1738368000000
}
```

### Client → Server Events

#### JOIN_SESSION

Player joins a session.

```json
{
  "type": "JOIN_SESSION",
  "payload": {
    "sessionCode": "ABC123",
    "playerName": "Alice",
    "avatar": "🦄"
  },
  "timestamp": 1738368000000
}
```

**Server Response**: `SESSION_STATE` + `PLAYER_JOINED` broadcast

#### SUBMIT_ANSWER

Player submits an answer.

```json
{
  "type": "SUBMIT_ANSWER",
  "payload": {
    "itemId": "item_123",
    "answer": {
      "optionId": "opt_2"
    }
  },
  "timestamp": 1738368000000
}
```

**Answer Formats**:
- **MCQ/True-False**: `{ "optionId": "opt_id" }`
- **Multiple Choice**: `{ "optionIds": ["opt_1", "opt_3"] }`
- **Open Text**: `{ "text": "My answer" }`
- **Ordering**: `{ "order": ["opt_2", "opt_1", "opt_3"] }`

**Server Response**: `ANSWER_RECEIVED` + `ANSWER_COUNT_UPDATED` broadcast

#### GAME_INPUT

Player sends game controller input (Swan Race).

```json
{
  "type": "GAME_INPUT",
  "payload": {
    "direction": { "x": 0.5, "y": 1.0 },
    "throttle": 0.8
  },
  "timestamp": 1738368000000
}
```

#### START_ITEM (Host only)

Host starts a quiz item.

```json
{
  "type": "START_ITEM",
  "payload": {
    "itemId": "item_123"
  },
  "timestamp": 1738368000000
}
```

**Server Response**: `ITEM_STARTED` broadcast

#### LOCK_ITEM (Host only)

Host locks answers for current item.

```json
{
  "type": "LOCK_ITEM",
  "payload": {
    "itemId": "item_123"
  },
  "timestamp": 1738368000000
}
```

**Server Response**: `ITEM_LOCKED` broadcast

#### REVEAL_ANSWERS (Host only)

Host reveals correct answers.

```json
{
  "type": "REVEAL_ANSWERS",
  "payload": {
    "itemId": "item_123"
  },
  "timestamp": 1738368000000
}
```

**Server Response**: `REVEAL` broadcast with scores

#### START_SWAN_RACE (Host only)

Host starts Swan Race mini-game.

```json
{
  "type": "START_SWAN_RACE",
  "payload": {},
  "timestamp": 1738368000000
}
```

**Server Response**: `SWAN_RACE_STARTED` broadcast

#### PAUSE_SESSION (Host only)

Host pauses the session.

```json
{
  "type": "PAUSE_SESSION",
  "payload": {},
  "timestamp": 1738368000000
}
```

**Server Response**: `SESSION_PAUSED` broadcast

#### RESUME_SESSION (Host only)

Host resumes the session.

```json
{
  "type": "RESUME_SESSION",
  "payload": {},
  "timestamp": 1738368000000
}
```

**Server Response**: `SESSION_RESUMED` broadcast

#### END_SESSION (Host only)

Host ends the session.

```json
{
  "type": "END_SESSION",
  "payload": {},
  "timestamp": 1738368000000
}
```

**Server Response**: `SESSION_ENDED` broadcast

### Server → Client Events

#### SESSION_STATE

Full session state sent on join or refresh.

```json
{
  "type": "SESSION_STATE",
  "payload": {
    "sessionId": "session_abc123",
    "code": "ABC123",
    "status": "LOBBY",
    "quiz": {
      "id": "quiz_xyz789",
      "title": "General Knowledge"
    },
    "players": [
      {
        "id": "player_1",
        "name": "Alice",
        "avatar": "🦄",
        "score": 0,
        "isConnected": true
      }
    ],
    "currentItemId": null
  },
  "timestamp": 1738368000000
}
```

#### PLAYER_JOINED

Broadcast when a player joins.

```json
{
  "type": "PLAYER_JOINED",
  "payload": {
    "player": {
      "id": "player_2",
      "name": "Bob",
      "avatar": "🐻",
      "score": 0
    }
  },
  "timestamp": 1738368000000
}
```

#### PLAYER_LEFT

Broadcast when a player disconnects.

```json
{
  "type": "PLAYER_LEFT",
  "payload": {
    "playerId": "player_2"
  },
  "timestamp": 1738368000000
}
```

#### ITEM_STARTED

Broadcast when host starts an item.

```json
{
  "type": "ITEM_STARTED",
  "payload": {
    "item": {
      "id": "item_123",
      "type": "QUESTION",
      "question": {
        "id": "q_xyz789",
        "type": "MCQ",
        "title": "Capital of France",
        "prompt": "What is the capital city of France?",
        "options": [
          { "id": "opt_1", "text": "London" },
          { "id": "opt_2", "text": "Paris" },
          { "id": "opt_3", "text": "Berlin" },
          { "id": "opt_4", "text": "Madrid" }
        ],
        "media": []
      }
    },
    "timeLimit": 30
  },
  "timestamp": 1738368000000
}
```

#### ITEM_LOCKED

Broadcast when answers are locked.

```json
{
  "type": "ITEM_LOCKED",
  "payload": {
    "itemId": "item_123"
  },
  "timestamp": 1738368000000
}
```

#### REVEAL

Broadcast when answers are revealed.

```json
{
  "type": "REVEAL",
  "payload": {
    "itemId": "item_123",
    "correctAnswer": {
      "optionIds": ["opt_2"]
    },
    "explanation": "Paris has been the capital since the 10th century.",
    "playerResults": [
      {
        "playerId": "player_1",
        "isCorrect": true,
        "pointsEarned": 10,
        "totalScore": 10
      },
      {
        "playerId": "player_2",
        "isCorrect": false,
        "pointsEarned": 0,
        "totalScore": 0
      }
    ]
  },
  "timestamp": 1738368000000
}
```

#### LEADERBOARD_UPDATE

Broadcast after reveal with updated standings.

```json
{
  "type": "LEADERBOARD_UPDATE",
  "payload": {
    "leaderboard": [
      {
        "rank": 1,
        "playerId": "player_1",
        "name": "Alice",
        "avatar": "🦄",
        "score": 150,
        "correctAnswers": 15
      },
      {
        "rank": 2,
        "playerId": "player_2",
        "name": "Bob",
        "avatar": "🐻",
        "score": 120,
        "correctAnswers": 12
      }
    ]
  },
  "timestamp": 1738368000000
}
```

#### SWAN_RACE_STARTED

Broadcast when Swan Race begins.

```json
{
  "type": "SWAN_RACE_STARTED",
  "payload": {
    "gameId": "game_123",
    "duration": 120,
    "mapSize": { "width": 1000, "height": 1000 }
  },
  "timestamp": 1738368000000
}
```

#### GAME_STATE

Real-time game state updates (60 FPS during Swan Race).

```json
{
  "type": "GAME_STATE",
  "payload": {
    "tick": 3600,
    "players": [
      {
        "id": "player_1",
        "position": { "x": 250.5, "y": 300.2 },
        "rotation": 1.57,
        "velocity": { "x": 2.5, "y": 0.1 },
        "isAlive": true,
        "score": 5
      }
    ],
    "swans": [
      {
        "id": "swan_1",
        "position": { "x": 300, "y": 350 },
        "rotation": 2.1,
        "targetPlayerId": "player_1"
      }
    ],
    "powerUps": [
      {
        "id": "powerup_1",
        "type": "FISH_LURE",
        "position": { "x": 500, "y": 500 }
      }
    ],
    "timeRemaining": 60
  },
  "timestamp": 1738368000000
}
```

#### ANSWER_RECEIVED

Acknowledgement sent to player who submitted answer.

```json
{
  "type": "ANSWER_RECEIVED",
  "payload": {
    "itemId": "item_123",
    "receivedAt": 1738368000000
  },
  "timestamp": 1738368000000
}
```

#### ANSWER_COUNT_UPDATED

Broadcast to host showing answer progress.

```json
{
  "type": "ANSWER_COUNT_UPDATED",
  "payload": {
    "itemId": "item_123",
    "answerCount": 12,
    "totalPlayers": 15
  },
  "timestamp": 1738368000000
}
```

#### SESSION_PAUSED

Broadcast when session is paused.

```json
{
  "type": "SESSION_PAUSED",
  "payload": {},
  "timestamp": 1738368000000
}
```

#### SESSION_RESUMED

Broadcast when session is resumed.

```json
{
  "type": "SESSION_RESUMED",
  "payload": {},
  "timestamp": 1738368000000
}
```

#### SESSION_ENDED

Broadcast when session ends.

```json
{
  "type": "SESSION_ENDED",
  "payload": {
    "finalLeaderboard": [
      {
        "rank": 1,
        "playerId": "player_1",
        "name": "Alice",
        "score": 150
      }
    ]
  },
  "timestamp": 1738368000000
}
```

#### ERROR

Error message from server.

```json
{
  "type": "ERROR",
  "payload": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session with code ABC123 does not exist"
  },
  "timestamp": 1738368000000
}
```

---

## Data Models

### Question Types

The platform supports 20+ question types:

**Standard**:
- `MCQ` - Multiple Choice Question (single answer)
- `TRUE_FALSE` - True/False question
- `OPEN` - Open text answer
- `ORDERING` - Order items correctly

**Photo-based**:
- `PHOTO_GUESS` - Guess what's in the photo
- `PHOTO_ZOOM_REVEAL` - Zoomed photo that gradually reveals
- `PHOTO_TIMELINE` - Order photos chronologically

**Music-based (Spotify)**:
- `MUSIC_GUESS_TITLE` - Guess the song title
- `MUSIC_GUESS_ARTIST` - Guess the artist
- `MUSIC_GUESS_YEAR` - Guess the release year
- `MUSIC_HITSTER_TIMELINE` - Order songs chronologically
- `MUSIC_OLDER_NEWER_THAN` - Determine if song is older/newer

**Video-based (YouTube)**:
- `YOUTUBE_SCENE_QUESTION` - Question about a video scene
- `YOUTUBE_NEXT_LINE` - Guess the next line of dialogue
- `YOUTUBE_WHO_SAID_IT` - Identify who said a quote

**Social/Party**:
- `POLL` - Opinion poll (no correct answer)
- `EMOJI_VOTE` - Vote with emoji reactions
- `CHAOS_EVENT` - Random fun event

### Workspace Roles

Roles determine permissions within a workspace:

| Role | Permissions |
|------|------------|
| `OWNER` | Full access, can delete workspace |
| `ADMIN` | Manage members, settings, content |
| `EDITOR` | Create/edit questions, quizzes, sessions |
| `CONTRIBUTOR` | Create content, view all |
| `VIEWER` | Read-only access |

### Session Status Flow

```
LOBBY → ITEM_INTRO → ITEM_ACTIVE → ITEM_LOCKED → REVEAL → LEADERBOARD
  ↓                                                              ↓
ENDED ←------------------------------------------------------------
```

- **LOBBY**: Waiting for players to join
- **ITEM_INTRO**: Showing next question preview
- **ITEM_ACTIVE**: Players can submit answers
- **ITEM_LOCKED**: Answers locked, waiting for reveal
- **REVEAL**: Showing correct answer and scores
- **LEADERBOARD**: Showing current standings
- **ENDED**: Session completed

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid question type",
  "details": {
    "field": "type",
    "expected": ["MCQ", "TRUE_FALSE", ...],
    "received": "INVALID_TYPE"
  }
}
```

### Common Error Codes

- `UNAUTHENTICATED` - No valid session
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `DUPLICATE_RESOURCE` - Resource already exists
- `SESSION_NOT_FOUND` - Invalid session code
- `SESSION_FULL` - Maximum players reached
- `ALREADY_ANSWERED` - Player already submitted answer
- `ITEM_NOT_ACTIVE` - Cannot answer locked/ended item
- `RATE_LIMITED` - Too many requests

---

## Rate Limiting

**Global Limits**:
- 100 requests per minute per IP
- 1000 requests per hour per user

**WebSocket**:
- 60 messages per second per connection (game input)
- 10 messages per second per connection (other events)

**Specific Endpoints**:
- Media upload: 10 per minute
- Question import: 5 per minute
- Session creation: 10 per hour

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1738368060
```

When rate limited:
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## Examples

### Complete Quiz Session Flow

```bash
# 1. Create workspace
curl -X POST https://api.example.com/api/workspaces \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace", "slug": "my-workspace"}'

# 2. Create questions
curl -X POST https://api.example.com/api/workspaces/ws_abc123/questions \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MCQ",
    "title": "Geography Question",
    "prompt": "What is the largest ocean?",
    "difficulty": 2,
    "tags": ["geography"],
    "status": "PUBLISHED",
    "options": [
      {"text": "Atlantic", "isCorrect": false},
      {"text": "Pacific", "isCorrect": true},
      {"text": "Indian", "isCorrect": false},
      {"text": "Arctic", "isCorrect": false}
    ]
  }'

# 3. Create quiz
curl -X POST https://api.example.com/api/workspaces/ws_abc123/quizzes \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "General Knowledge Quiz",
    "description": "Test your trivia skills",
    "rounds": [
      {
        "title": "Round 1",
        "items": [
          {"type": "QUESTION", "questionId": "q_xyz789"}
        ]
      }
    ]
  }'

# 4. Start live session
curl -X POST https://api.example.com/api/workspaces/ws_abc123/sessions \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"quizId": "quiz_xyz789"}'

# Response: {"session": {"code": "ABC123", ...}}

# 5. Players join via WebSocket (see WebSocket section)

# 6. Export results after session
curl https://api.example.com/api/sessions/session_abc123/export?format=csv \
  -H "Cookie: next-auth.session-token=..." \
  -o results.csv
```

---

## Changelog

### Version 1.0 (January 31, 2026)

- Initial API documentation
- REST endpoints for all core features
- WebSocket protocol documented
- Question export/import endpoints added
- Session results CSV export added
- Workspace branding endpoints added
- Quiz templates support added

---

## Support

For API support:
- **Documentation**: https://github.com/Eddiekoma/partyquiz-platform
- **Issues**: https://github.com/Eddiekoma/partyquiz-platform/issues
- **Email**: support@databridge360.com

---

**Last Updated**: January 31, 2026  
**API Version**: 1.0
