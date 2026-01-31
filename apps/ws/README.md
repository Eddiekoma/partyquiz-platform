# PartyQuiz WebSocket Server

Real-time communication server for live quiz sessions using Socket.io.

## Features

- ✅ **Player Management**: Join sessions with codes, track active players
- ✅ **Host Controls**: Start items, lock answers, reveal results, end sessions
- ✅ **Real-time Answers**: Submit and track answers with validation
- ✅ **Session State**: Synchronized state across all connected clients
- ✅ **Mini-game Support**: Game input broadcasting for Swan Race etc.
- ✅ **Auto Cleanup**: Empty sessions removed after 5 minutes
- ✅ **Health Checks**: `/healthz` endpoint for monitoring

## WebSocket Events

### Client → Server (Player)

- `JOIN_SESSION`: Player joins with `{ sessionCode, playerName, avatar? }`
- `SUBMIT_ANSWER`: Submit answer `{ sessionCode, itemId, answer }`
- `GAME_INPUT`: Mini-game input `{ sessionCode, input }`

### Client → Server (Host)

- `START_ITEM`: Start question `{ sessionCode, itemId, timerDuration? }`
- `LOCK_ITEM`: Lock answers `{ sessionCode }`
- `REVEAL_ANSWERS`: Show results `{ sessionCode }`
- `END_SESSION`: End session `{ sessionCode }`

### Server → Client

- `SESSION_STATE`: Full session state on join
- `PLAYER_JOINED`: New player notification
- `PLAYER_LEFT`: Player disconnected
- `ITEM_STARTED`: Question started with timer
- `ITEM_LOCKED`: No more answers accepted
- `REVEAL_ANSWERS`: Results with all answers
- `ANSWER_RECEIVED`: Answer acknowledgement
- `ANSWER_COUNT_UPDATED`: Answer count for host
- `SESSION_ENDED`: Final scores
- `error`: Error messages

## Session State

```typescript
{
  sessionId: string;
  sessionCode: string;          // 6-char code for joining
  status: string;                // LOBBY | ITEM_ACTIVE | ITEM_LOCKED | REVEAL | ENDED
  currentItemId: string | null;  // Active question ID
  currentItemIndex: number;      // Question number
  itemStartedAt: number | null;  // Start timestamp
  timerDuration: number | null;  // Timer in seconds
  players: Map<id, PlayerState>;
  answers: Map<key, answer>;     // key: `${itemId}:${playerId}`
  hostSocketId: string | null;   // First to start item becomes host
}
```

## Development

```bash
# Start dev server with hot reload
pnpm dev

# Type check
pnpm type-check

# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

```env
WS_PORT=8080                          # WebSocket server port
APP_BASE_URL=http://localhost:3000    # CORS origin
NODE_ENV=development|production
```

## Architecture

- **In-Memory State**: Session state stored in memory (migrate to Redis for multi-instance)
- **Socket.io Rooms**: Each session is a room, players auto-join
- **Host-Only Controls**: First socket to start item becomes host, only host can control
- **Validation**: Checks session exists, item is active, player is in session
- **Auto-Cleanup**: Empty sessions removed after 5 minutes of inactivity

## Next Steps

- [ ] Integrate with Prisma to load session data from DB
- [ ] Validate session codes against LiveSession table
- [ ] Save LivePlayer records on join
- [ ] Save LiveAnswer records with scoring
- [ ] Implement answer validation by question type
- [ ] Add scoring logic (base points + time bonus)
- [ ] Migrate to Redis for multi-instance support
- [ ] Add player reconnection with deviceIdHash
- [ ] Implement proper session state persistence

## Security

- Host-only restrictions for session controls
- Session code validation (future: check DB)
- Player validation before accepting answers
- Item state validation (must be ITEM_ACTIVE)
- Error handling for all events
