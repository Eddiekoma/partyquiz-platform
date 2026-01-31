import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { pino } from "pino";
import { WSMessageType, validateAndScore, QuestionType } from "@partyquiz/shared";
import {
  redis,
  cacheSessionState,
  getSessionState,
  updateLeaderboard,
  getLeaderboard,
  addActivePlayer,
  removeActivePlayer,
  getActivePlayerCount,
  cachePlayer,
  getPlayer,
  checkRateLimit,
} from "@partyquiz/shared/src/redis";
import { prisma } from "./lib/prisma";
import "dotenv/config";

// Swan Race Game State
interface SwanRaceState {
  sessionCode: string;
  players: Map<string, {
    id: string;
    name: string;
    position: number;
    velocity: number;
    lastStroke: number;
  }>;
  startTime: number;
  finishLine: number;
  finishedPlayers: string[];
  isActive: boolean;
}

const swanRaceGames = new Map<string, SwanRaceState>();

// Connection Status Tracking
interface PlayerConnection {
  playerId: string;
  playerName: string;
  socketId: string;
  connectedAt: number;
  lastHeartbeat: number;
  isOnline: boolean;
}

const sessionConnections = new Map<string, Map<string, PlayerConnection>>();

function trackPlayerConnection(sessionCode: string, playerId: string, playerName: string, socketId: string) {
  if (!sessionConnections.has(sessionCode)) {
    sessionConnections.set(sessionCode, new Map());
  }
  
  const connections = sessionConnections.get(sessionCode)!;
  connections.set(playerId, {
    playerId,
    playerName,
    socketId,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    isOnline: true,
  });
  
  logger.info({ sessionCode, playerId, playerName }, "Player connection tracked");
}

function updatePlayerHeartbeat(sessionCode: string, playerId: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return;
  
  const player = connections.get(playerId);
  if (player) {
    player.lastHeartbeat = Date.now();
  }
}

function markPlayerOffline(sessionCode: string, playerId: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return;
  
  const player = connections.get(playerId);
  if (player) {
    player.isOnline = false;
    logger.info({ sessionCode, playerId }, "Player marked offline");
  }
}

function getSessionConnections(sessionCode: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return [];
  
  return Array.from(connections.values()).map(conn => ({
    playerId: conn.playerId,
    playerName: conn.playerName,
    isOnline: conn.isOnline,
    connectedAt: conn.connectedAt,
    lastHeartbeat: conn.lastHeartbeat,
    connectionQuality: getConnectionQuality(conn),
  }));
}

function getConnectionQuality(conn: PlayerConnection): 'good' | 'poor' | 'offline' {
  if (!conn.isOnline) return 'offline';
  
  const timeSinceHeartbeat = Date.now() - conn.lastHeartbeat;
  if (timeSinceHeartbeat > 10000) return 'offline';
  if (timeSinceHeartbeat > 5000) return 'poor';
  return 'good';
}

function startSwanRace(sessionCode: string, playerIds: string[], playerNames: string[]) {
  const players = new Map();
  playerIds.forEach((id, idx) => {
    players.set(id, {
      id,
      name: playerNames[idx] || `Player ${idx + 1}`,
      position: 0,
      velocity: 0,
      lastStroke: Date.now(),
    });
  });

  swanRaceGames.set(sessionCode, {
    sessionCode,
    players,
    startTime: Date.now(),
    finishLine: 800,
    finishedPlayers: [],
    isActive: true,
  });

  logger.info({ sessionCode, playerCount: players.size }, "Swan Race started");
}

function updateSwanRace(sessionCode: string, playerId: string, strokeDuration: number) {
  const game = swanRaceGames.get(sessionCode);
  if (!game || !game.isActive) return null;

  const player = game.players.get(playerId);
  if (!player) return null;

  // Update velocity based on stroke duration
  const timeSinceLastStroke = Date.now() - player.lastStroke;
  const decay = Math.max(0, 1 - (timeSinceLastStroke / 2000)); // Decay over 2 seconds
  
  // Stroke power: longer hold = more power (max 300ms)
  const strokePower = Math.min(strokeDuration / 300, 1) * 15;
  player.velocity = (player.velocity * decay) + strokePower;
  player.lastStroke = Date.now();

  // Update position
  player.position += player.velocity;

  // Check if finished
  if (player.position >= game.finishLine && !game.finishedPlayers.includes(playerId)) {
    game.finishedPlayers.push(playerId);
    logger.info({ sessionCode, playerId, position: game.finishedPlayers.length }, "Player finished Swan Race");
  }

  // Check if race is finished (all players crossed or 60 seconds elapsed)
  const raceTime = Date.now() - game.startTime;
  if (game.finishedPlayers.length === game.players.size || raceTime > 60000) {
    game.isActive = false;
    logger.info({ sessionCode, finishedCount: game.finishedPlayers.length }, "Swan Race ended");
  }

  return {
    players: Array.from(game.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      position: { x: p.position, y: 0 },
      velocity: p.velocity,
    })),
    raceFinished: !game.isActive,
    finalPositions: game.finishedPlayers,
  };
}

function stopSwanRace(sessionCode: string) {
  swanRaceGames.delete(sessionCode);
  logger.info({ sessionCode }, "Swan Race stopped");
}

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

const PORT = process.env.WS_PORT || 8080;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.APP_BASE_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/ws",
});

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "Client connected");

  // Player joins session with code
  socket.on(
    WSMessageType.JOIN_SESSION,
    async (data: { sessionCode: string; playerName: string; avatar?: string; deviceIdHash?: string }) => {
      try {
        const { sessionCode, playerName, avatar, deviceIdHash } = data;
        logger.info({ sessionCode, playerName }, "Player attempting to join session");

        // Validate session exists in database
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
          include: {
            players: {
              where: { leftAt: null },
            },
          },
        });

        if (!session) {
          logger.warn({ sessionCode }, "Session not found");
          socket.emit(WSMessageType.ERROR, {
            message: "Session not found",
            code: "SESSION_NOT_FOUND",
          });
          return;
        }

        if (session.status === "ENDED") {
          logger.warn({ sessionCode }, "Session already ended");
          socket.emit(WSMessageType.ERROR, {
            message: "Session has ended",
            code: "SESSION_ENDED",
          });
          return;
        }

        // Create or update player in database
        const player = await prisma.livePlayer.create({
          data: {
            sessionId: session.id,
            name: playerName,
            avatar: avatar || null,
            deviceIdHash: deviceIdHash || `socket-${socket.id}`,
            joinedAt: new Date(),
          },
        });

        logger.info({ playerId: player.id, sessionCode }, "Player joined session");

        // Cache player data in Redis
        await cachePlayer(sessionCode, player.id, {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          score: 0,
        });

        // Add to active players set
        await addActivePlayer(sessionCode, player.id);

        // Initialize leaderboard score
        await updateLeaderboard(sessionCode, player.id, 0);

        // Join socket room
        socket.join(sessionCode);

        // Store player info in socket data
        socket.data.playerId = player.id;
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = session.id;

        // Track connection status
        trackPlayerConnection(sessionCode, player.id, playerName, socket.id);

        // Send session state to player
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId: session.id,
          sessionCode: session.code,
          status: session.status,
          playerId: player.id,
          players: session.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: 0, // Score calculated from answers later
          })),
        });

        // Notify others in the session
        socket.to(sessionCode).emit(WSMessageType.PLAYER_JOINED, {
          playerId: player.id,
          name: playerName,
          avatar,
          score: 0,
        });

        // Send connection status update to host
        const connections = getSessionConnections(sessionCode);
        io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
          connections,
        });

        logger.info({ playerId: player.id, sessionCode }, "Player joined successfully");
      } catch (error) {
        logger.error({ error }, "Error joining session");
        socket.emit("error", { message: "Failed to join session" });
      }
    }
  );

  // Host starts a quiz item (question)
  socket.on(
    WSMessageType.START_ITEM,
    async (data: { sessionCode: string; itemId: string; timerDuration?: number }) => {
      try {
        const { sessionCode, itemId, timerDuration } = data;
        logger.info({ sessionCode, itemId, timerDuration }, "Host starting item");

        // Verify session exists
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
        });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const startedAt = Date.now();

        // Broadcast to all players
        io.to(sessionCode).emit(WSMessageType.ITEM_STARTED, {
          itemId,
          startedAt,
          timerDuration: timerDuration || null,
        });

        logger.info({ sessionCode, itemId, timerDuration }, "Item started");
      } catch (error) {
        logger.error({ error }, "Error starting item");
        socket.emit("error", { message: "Failed to start item" });
      }
    }
  );

  // Host locks item (no more answers)
  socket.on(WSMessageType.LOCK_ITEM, async (data: { sessionCode: string; itemId: string }) => {
    try {
      const { sessionCode, itemId } = data;
      logger.info({ sessionCode, itemId }, "Host locking item");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      const lockedAt = Date.now();

      io.to(sessionCode).emit(WSMessageType.ITEM_LOCKED, {
        itemId,
        lockedAt,
      });

      logger.info({ sessionCode, itemId }, "Item locked");
    } catch (error) {
      logger.error({ error }, "Error locking item");
      socket.emit("error", { message: "Failed to lock item" });
    }
  });

  // Host reveals answers
  socket.on(WSMessageType.REVEAL_ANSWERS, async (data: { sessionCode: string; itemId: string }) => {
    try {
      const { sessionCode, itemId } = data;
      logger.info({ sessionCode, itemId }, "Host revealing answers");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Get answers for current item from database
      const answers = await prisma.liveAnswer.findMany({
        where: {
          sessionId: session.id,
          quizItemId: itemId,
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          answeredAt: "asc",
        },
      });

      io.to(sessionCode).emit(WSMessageType.REVEAL_ANSWERS, {
        itemId,
        answers: answers.map((a) => ({
          playerId: a.playerId,
          playerName: a.player.name,
          answer: a.payloadJson,
          isCorrect: a.isCorrect,
          points: a.score,
        })),
      });

      logger.info({ sessionCode, itemId, answerCount: answers.length }, "Answers revealed");
    } catch (error) {
      logger.error({ error }, "Error revealing answers");
      socket.emit("error", { message: "Failed to reveal answers" });
    }
  });

  // Player submits answer
  socket.on(
    WSMessageType.SUBMIT_ANSWER,
    async (data: { sessionCode: string; itemId: string; answer: any; submittedAtMs?: number }) => {
      try {
        const { sessionCode, itemId, answer, submittedAtMs } = data;
        const playerId = socket.data.playerId;

        logger.info({ playerId, sessionCode, itemId }, "Answer submitted");

        if (!playerId) {
          socket.emit("error", { message: "Player not authenticated" });
          return;
        }

        // Check if session is paused
        const isPaused = await redis.get(`session:${sessionCode}:paused`);
        if (isPaused === "true") {
          socket.emit(WSMessageType.ERROR, {
            message: "Session is paused. Please wait for the host to resume.",
          });
          return;
        }

        // Verify session and player exist
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
        });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const player = await prisma.livePlayer.findUnique({
          where: { id: playerId },
        });

        if (!player || player.sessionId !== session.id) {
          socket.emit("error", { message: "Player not in session" });
          return;
        }

        // Rate limiting: max 10 answers per minute per player
        const rateLimitKey = `answer:${playerId}`;
        const rateLimit = await checkRateLimit(rateLimitKey, 10, 60);
        
        if (!rateLimit.allowed) {
          socket.emit(WSMessageType.ERROR, {
            message: "Too many answers. Please slow down.",
            code: "RATE_LIMIT_EXCEEDED",
          });
          logger.warn({ playerId, remaining: rateLimit.remaining }, "Rate limit exceeded");
          return;
        }

        // Check if already answered this item
        const existingAnswer = await prisma.liveAnswer.findFirst({
          where: {
            sessionId: session.id,
            playerId,
            quizItemId: itemId,
          },
        });

        if (existingAnswer) {
          socket.emit("error", { message: "Already answered this question" });
          return;
        }

        // Get quiz item with question details for validation
        const quizItem = await prisma.quizItem.findUnique({
          where: { id: itemId },
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        });

        if (!quizItem || !quizItem.question) {
          socket.emit("error", { message: "Question not found" });
          return;
        }

        const question = quizItem.question;
        const questionType = question.type as QuestionType;

        // Get correct answer based on question type
        let correctAnswer: any;
        const correctOptions = question.options.filter((opt) => opt.isCorrect);

        if (correctOptions.length > 0) {
          // MCQ, TRUE_FALSE, etc. - use option IDs
          if (correctOptions.length === 1) {
            correctAnswer = correctOptions[0].id;
          } else {
            correctAnswer = correctOptions.map((opt) => opt.id);
          }
        } else {
          // OPEN, MUSIC_GUESS_TITLE, etc. - use first option text as correct answer
          // Or could be stored in settingsJson
          const settingsJson = quizItem.settingsJson as any;
          correctAnswer = settingsJson?.correctAnswer || question.options[0]?.text || "";
        }

        // Get scoring settings from quizItem.settingsJson
        const settingsJson = quizItem.settingsJson as any;
        const basePoints = settingsJson?.points || 1000;
        const timeLimitMs = settingsJson?.timeLimit ? settingsJson.timeLimit * 1000 : undefined;

        // Calculate time spent (if item was started with timestamp tracking)
        let timeSpentMs: number | undefined;
        if (submittedAtMs && settingsJson?.itemStartedAtMs) {
          timeSpentMs = submittedAtMs - settingsJson.itemStartedAtMs;
        }

        // Get current streak for this player
        const previousAnswers = await prisma.liveAnswer.findMany({
          where: {
            sessionId: session.id,
            playerId,
          },
          orderBy: {
            answeredAt: "desc",
          },
          take: 10, // Check last 10 answers for streak
        });

        let currentStreak = 0;
        for (const prevAnswer of previousAnswers) {
          if (prevAnswer.isCorrect) {
            currentStreak++;
          } else {
            break;
          }
        }

        // Validate and score the answer
        const validation = validateAndScore(
          questionType,
          answer,
          correctAnswer,
          basePoints,
          timeSpentMs,
          timeLimitMs,
          currentStreak
        );

        // Store answer in database
        const liveAnswer = await prisma.liveAnswer.create({
          data: {
            sessionId: session.id,
            playerId,
            quizItemId: itemId,
            payloadJson: answer,
            isCorrect: validation.isCorrect,
            score: validation.score,
          },
        });

        // Acknowledge to player with validation result
        socket.emit(WSMessageType.ANSWER_RECEIVED, {
          itemId,
          timestamp: Date.now(),
          isCorrect: validation.isCorrect,
          score: validation.score,
          streak: validation.isCorrect ? currentStreak + 1 : 0,
        });

        // Update leaderboard in Redis if answer was correct
        if (validation.isCorrect) {
          // Get player's cached data
          const cachedPlayer = await getPlayer(sessionCode, playerId);
          const newScore = (cachedPlayer?.score || 0) + validation.score;

          // Update Redis leaderboard
          await updateLeaderboard(sessionCode, playerId, newScore);

          // Update cached player data
          await cachePlayer(sessionCode, playerId, {
            ...cachedPlayer,
            score: newScore,
          });

          // Get top 10 from Redis (super fast!)
          const leaderboard = await getLeaderboard(sessionCode, 10);

          // Enrich with player details from cache
          const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
              const player = await getPlayer(sessionCode, entry.playerId);
              return {
                playerId: entry.playerId,
                playerName: player?.name || "Unknown",
                avatar: player?.avatar || "👤",
                totalScore: entry.score,
              };
            })
          );

          // Broadcast updated leaderboard
          io.to(sessionCode).emit(WSMessageType.LEADERBOARD_UPDATE, {
            leaderboard: enrichedLeaderboard,
          });
        }

        // Get total answer count for this item
        const answerCount = await prisma.liveAnswer.count({
          where: {
            sessionId: session.id,
            quizItemId: itemId,
          },
        });

        // Get total player count from Redis (cached)
        const totalPlayers = await getActivePlayerCount(sessionCode);

        // Notify host of answer count
        io.to(sessionCode).emit(WSMessageType.ANSWER_COUNT_UPDATED, {
          itemId,
          count: answerCount,
          total: totalPlayers,
        });

        logger.info(
          {
            playerId,
            itemId,
            answerId: liveAnswer.id,
            isCorrect: validation.isCorrect,
            score: validation.score,
          },
          "Answer stored and validated"
        );
      } catch (error) {
        logger.error({ error }, "Error submitting answer");
        socket.emit("error", { message: "Failed to submit answer" });
      }
    }
  );

  // Game input for mini-games (Swan Race, etc.)
  socket.on(WSMessageType.GAME_INPUT, (data: { sessionCode: string; playerId: string; input: any }) => {
    try {
      const { sessionCode, playerId, input } = data;
      logger.debug({ playerId, sessionCode, input }, "Game input received");

      // Handle Swan Race input
      if (input.action === "STROKE") {
        const gameState = updateSwanRace(sessionCode, playerId, input.duration || 0);
        if (gameState) {
          // Broadcast updated game state to all players
          io.to(sessionCode).emit("GAME_STATE", gameState);

          // Award points if race finished
          if (gameState.raceFinished && gameState.finalPositions) {
            gameState.finalPositions.forEach(async (pid, index) => {
              const points = Math.max(10 - index * 2, 1); // 1st: 10pts, 2nd: 8pts, 3rd: 6pts, etc.
              try {
                await updateLeaderboard(sessionCode, pid, points);
                logger.info({ sessionCode, playerId: pid, position: index + 1, points }, "Swan Race points awarded");
              } catch (error) {
                logger.error({ error, playerId: pid }, "Failed to award Swan Race points");
              }
            });

            // Stop the race
            setTimeout(() => stopSwanRace(sessionCode), 3000); // 3 second delay for celebration
          }
        }
      } else {
        // Fallback: broadcast input to all players in session
        socket.to(sessionCode).emit(WSMessageType.GAME_INPUT, {
          playerId,
          input,
        });
      }
    } catch (error) {
      logger.error({ error }, "Error processing game input");
    }
  });

  // Start Swan Race (Host action)
  socket.on(WSMessageType.START_SWAN_RACE, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host starting Swan Race");

      // Get active players from Redis
      const playerKeys = await redis.keys(`session:${sessionCode}:player:*`);
      const players = await Promise.all(
        playerKeys.map(async (key) => {
          const playerData = await redis.get(key);
          return playerData ? JSON.parse(playerData) : null;
        })
      );

      const validPlayers = players.filter((p) => p !== null);
      const playerIds = validPlayers.map((p) => p.id);
      const playerNames = validPlayers.map((p) => p.name);

      if (playerIds.length === 0) {
        socket.emit("error", { message: "No players in session" });
        return;
      }

      // Start the race
      startSwanRace(sessionCode, playerIds, playerNames);

      // Notify all players
      io.to(sessionCode).emit(WSMessageType.SWAN_RACE_STARTED, {
        playerCount: playerIds.length,
      });

      logger.info({ sessionCode, playerCount: playerIds.length }, "Swan Race started successfully");
    } catch (error) {
      logger.error({ error }, "Error starting Swan Race");
      socket.emit("error", { message: "Failed to start Swan Race" });
    }
  });

  // Host ends session
  socket.on(WSMessageType.END_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host ending session");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Update session to ENDED
      await prisma.liveSession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: new Date(),
        },
      });

      // Calculate final scores from answers
      const players = await prisma.livePlayer.findMany({
        where: { sessionId: session.id },
        include: {
          answers: {
            select: {
              score: true,
            },
          },
        },
      });

      const finalScores = players
        .map((p) => ({
          id: p.id,
          name: p.name,
          score: p.answers.reduce((sum, a) => sum + a.score, 0),
        }))
        .sort((a, b) => b.score - a.score);

      io.to(sessionCode).emit(WSMessageType.SESSION_ENDED, {
        sessionId: session.id,
        endedAt: Date.now(),
        finalScores,
      });

      logger.info({ sessionCode, playerCount: players.length }, "Session ended");
    } catch (error) {
      logger.error({ error }, "Error ending session");
      socket.emit("error", { message: "Failed to end session" });
    }
  });

  // Pause session
  socket.on(WSMessageType.PAUSE_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;

      logger.info({ sessionCode }, "Pausing session");

      // Store pause state in Redis
      await redis.set(`session:${sessionCode}:paused`, "true");
      await redis.set(`session:${sessionCode}:pausedAt`, Date.now().toString());

      // Notify all clients
      io.to(sessionCode).emit(WSMessageType.SESSION_PAUSED, {
        sessionCode,
        pausedAt: Date.now(),
      });

      logger.info({ sessionCode }, "Session paused");
    } catch (error) {
      logger.error({ error }, "Error pausing session");
      socket.emit("error", { message: "Failed to pause session" });
    }
  });

  // Resume session
  socket.on(WSMessageType.RESUME_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;

      logger.info({ sessionCode }, "Resuming session");

      // Remove pause state from Redis
      await redis.del(`session:${sessionCode}:paused`);
      await redis.del(`session:${sessionCode}:pausedAt`);

      // Notify all clients
      io.to(sessionCode).emit(WSMessageType.SESSION_RESUMED, {
        sessionCode,
        resumedAt: Date.now(),
      });

      logger.info({ sessionCode }, "Session resumed");
    } catch (error) {
      logger.error({ error }, "Error resuming session");
      socket.emit("error", { message: "Failed to resume session" });
    }
  });

  // Handle heartbeat for connection tracking
  socket.on("HEARTBEAT", () => {
    const playerId = socket.data.playerId;
    const sessionCode = socket.data.sessionCode;

    if (playerId && sessionCode) {
      updatePlayerHeartbeat(sessionCode, playerId);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    try {
      const playerId = socket.data.playerId;
      const sessionCode = socket.data.sessionCode;

      logger.info({ socketId: socket.id, playerId, sessionCode }, "Client disconnected");

      if (!playerId || !sessionCode) {
        return;
      }

      // Mark player as offline in connection tracking
      markPlayerOffline(sessionCode, playerId);

      // Send connection status update to host
      const connections = getSessionConnections(sessionCode);
      io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
        connections,
      });

      // Update player's leftAt timestamp
      const player = await prisma.livePlayer.update({
        where: { id: playerId },
        data: { leftAt: new Date() },
      });

      // Remove from Redis active players
      await removeActivePlayer(sessionCode, playerId);

      // Notify others in the session
      socket.to(sessionCode).emit(WSMessageType.PLAYER_LEFT, {
        playerId: player.id,
        name: player.name,
      });

      logger.info({ playerId, sessionCode }, "Player left session");
    } catch (error) {
      logger.error({ error }, "Error handling disconnect");
    }
  });
});

// Health check endpoint
httpServer.on("request", async (req, res) => {
  if (req.url === "/healthz" || req.url === "/health") {
    try {
      // Get statistics from database
      const activeSessions = await prisma.liveSession.count({
        where: {
          status: {
            in: ["WAITING", "ACTIVE"],
          },
        },
      });

      const totalPlayers = await prisma.livePlayer.count({
        where: {
          leftAt: null,
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          activeSessions,
          totalPlayers,
        })
      );
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", message: "Database connection failed" }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start server
httpServer.listen(PORT, () => {
  logger.info({ port: PORT, path: "/ws" }, "WebSocket server started");
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...");
  io.close(() => {
    httpServer.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  io.close(() => {
    httpServer.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
});
