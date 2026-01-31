import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { pino } from "pino";
import { WSMessageType } from "@partyquiz/shared";
import "dotenv/config";

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

// Session state store (in-memory for now, move to Redis for multi-instance)
interface PlayerState {
  id: string;
  socketId: string;
  name: string;
  avatar?: string;
  score: number;
  joinedAt: number;
}

interface SessionState {
  sessionId: string;
  sessionCode: string;
  status: string;
  currentRoundIndex: number;
  currentItemIndex: number;
  currentItemId: string | null;
  itemStartedAt: number | null;
  timerDuration: number | null;
  players: Map<string, PlayerState>;
  answers: Map<string, any>; // key: `${itemId}:${playerId}`
  hostSocketId: string | null;
}

const sessions = new Map<string, SessionState>();

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "Client connected");

  // Player joins session with code
  socket.on(
    WSMessageType.JOIN_SESSION,
    async (data: { sessionCode: string; playerName: string; avatar?: string }) => {
      try {
        const { sessionCode, playerName, avatar } = data;
        logger.info({ sessionCode, playerName }, "Player attempting to join session");

        // Find or create session state
        let sessionState = Array.from(sessions.values()).find((s) => s.sessionCode === sessionCode);

        if (!sessionState) {
          // Session not in memory - lazy load from DB later
          logger.info({ sessionCode }, "Session not in memory, creating state");

          sessionState = {
            sessionId: sessionCode, // Will be replaced with actual ID from DB
            sessionCode,
            status: "LOBBY",
            currentRoundIndex: 0,
            currentItemIndex: 0,
            currentItemId: null,
            itemStartedAt: null,
            timerDuration: null,
            players: new Map(),
            answers: new Map(),
            hostSocketId: null,
          };
          sessions.set(sessionCode, sessionState);
        }

        const playerId = socket.id;
        socket.join(sessionCode);

        // Add player to session state
        sessionState.players.set(playerId, {
          id: playerId,
          socketId: socket.id,
          name: playerName,
          avatar,
          score: 0,
          joinedAt: Date.now(),
        });

        // Send session state to player
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId: sessionState.sessionId,
          sessionCode: sessionState.sessionCode,
          status: sessionState.status,
          currentItemId: sessionState.currentItemId,
          currentItemIndex: sessionState.currentItemIndex,
          players: Array.from(sessionState.players.values()).map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: p.score,
          })),
        });

        // Notify others in the session
        socket.to(sessionCode).emit(WSMessageType.PLAYER_JOINED, {
          playerId,
          name: playerName,
          avatar,
          score: 0,
        });

        logger.info({ sessionCode, playerId, playerName, totalPlayers: sessionState.players.size }, "Player joined");
      } catch (error) {
        logger.error({ error }, "Error joining session");
        socket.emit("error", { message: "Failed to join session" });
      }
    }
  );

  // Host starts a quiz item (question)
  socket.on(
    WSMessageType.START_ITEM,
    (data: { sessionCode: string; itemId: string; timerDuration?: number }) => {
      try {
        const { sessionCode, itemId, timerDuration } = data;
        logger.info({ sessionCode, itemId, timerDuration }, "Host starting item");

        const sessionState = sessions.get(sessionCode);
        if (!sessionState) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        // Verify socket is host
        if (sessionState.hostSocketId && sessionState.hostSocketId !== socket.id) {
          socket.emit("error", { message: "Only host can start items" });
          return;
        }

        // Set host if not set
        if (!sessionState.hostSocketId) {
          sessionState.hostSocketId = socket.id;
        }

        // Update session state
        sessionState.status = "ITEM_ACTIVE";
        sessionState.currentItemId = itemId;
        sessionState.itemStartedAt = Date.now();
        sessionState.timerDuration = timerDuration || null;

        // Broadcast to all players
        io.to(sessionCode).emit(WSMessageType.ITEM_STARTED, {
          itemId,
          startedAt: sessionState.itemStartedAt,
          timerDuration: sessionState.timerDuration,
        });

        logger.info({ sessionCode, itemId }, "Item started");
      } catch (error) {
        logger.error({ error }, "Error starting item");
        socket.emit("error", { message: "Failed to start item" });
      }
    }
  );

  // Host locks item (no more answers)
  socket.on(WSMessageType.LOCK_ITEM, (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host locking item");

      const sessionState = sessions.get(sessionCode);
      if (!sessionState) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      if (sessionState.hostSocketId !== socket.id) {
        socket.emit("error", { message: "Only host can lock items" });
        return;
      }

      sessionState.status = "ITEM_LOCKED";

      io.to(sessionCode).emit(WSMessageType.ITEM_LOCKED, {
        itemId: sessionState.currentItemId,
        lockedAt: Date.now(),
      });

      logger.info({ sessionCode, itemId: sessionState.currentItemId }, "Item locked");
    } catch (error) {
      logger.error({ error }, "Error locking item");
      socket.emit("error", { message: "Failed to lock item" });
    }
  });

  // Host reveals answers
  socket.on(WSMessageType.REVEAL_ANSWERS, (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host revealing answers");

      const sessionState = sessions.get(sessionCode);
      if (!sessionState) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      if (sessionState.hostSocketId !== socket.id) {
        socket.emit("error", { message: "Only host can reveal answers" });
        return;
      }

      sessionState.status = "REVEAL";

      // Get answers for current item
      const itemId = sessionState.currentItemId;
      const answers = Array.from(sessionState.answers.entries())
        .filter(([key]) => key.startsWith(`${itemId}:`))
        .map(([, value]) => value);

      io.to(sessionCode).emit(WSMessageType.REVEAL_ANSWERS, {
        itemId,
        answers,
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
    (data: { sessionCode: string; itemId: string; answer: any }) => {
      try {
        const { sessionCode, itemId, answer } = data;
        logger.info({ socketId: socket.id, sessionCode, itemId }, "Answer submitted");

        const sessionState = sessions.get(sessionCode);
        if (!sessionState) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const player = sessionState.players.get(socket.id);
        if (!player) {
          socket.emit("error", { message: "Player not in session" });
          return;
        }

        // Check if item is still active
        if (sessionState.status !== "ITEM_ACTIVE") {
          socket.emit("error", { message: "Item is not active" });
          return;
        }

        // Check if answering correct item
        if (sessionState.currentItemId !== itemId) {
          socket.emit("error", { message: "Wrong item" });
          return;
        }

        // Store answer (key format: itemId:playerId)
        const answerKey = `${itemId}:${socket.id}`;
        sessionState.answers.set(answerKey, {
          playerId: socket.id,
          playerName: player.name,
          itemId,
          answer,
          timestamp: Date.now(),
        });

        // Acknowledge to player
        socket.emit(WSMessageType.ANSWER_RECEIVED, {
          itemId,
          timestamp: Date.now(),
        });

        // Notify host of answer count
        if (sessionState.hostSocketId) {
          const answerCount = Array.from(sessionState.answers.keys()).filter((key) => key.startsWith(`${itemId}:`))
            .length;

          io.to(sessionState.hostSocketId).emit(WSMessageType.ANSWER_COUNT_UPDATED, {
            itemId,
            count: answerCount,
            total: sessionState.players.size,
          });
        }

        logger.info(
          { playerId: socket.id, itemId, answerKey, totalAnswers: sessionState.answers.size },
          "Answer stored"
        );
      } catch (error) {
        logger.error({ error }, "Error submitting answer");
        socket.emit("error", { message: "Failed to submit answer" });
      }
    }
  );

  // Game input for mini-games (Swan Race, etc.)
  socket.on(WSMessageType.GAME_INPUT, (data: { sessionCode: string; input: any }) => {
    try {
      const { sessionCode, input } = data;
      logger.debug({ socketId: socket.id, sessionCode, input }, "Game input received");

      const sessionState = sessions.get(sessionCode);
      if (!sessionState) return;

      // Broadcast input to all players
      socket.to(sessionCode).emit(WSMessageType.GAME_INPUT, {
        playerId: socket.id,
        input,
      });
    } catch (error) {
      logger.error({ error }, "Error processing game input");
    }
  });

  // Host ends session
  socket.on(WSMessageType.END_SESSION, (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host ending session");

      const sessionState = sessions.get(sessionCode);
      if (!sessionState) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      if (sessionState.hostSocketId !== socket.id) {
        socket.emit("error", { message: "Only host can end session" });
        return;
      }

      sessionState.status = "ENDED";

      // Calculate final scores
      const finalScores = Array.from(sessionState.players.values())
        .map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
        }))
        .sort((a, b) => b.score - a.score);

      io.to(sessionCode).emit(WSMessageType.SESSION_ENDED, {
        sessionId: sessionState.sessionId,
        endedAt: Date.now(),
        finalScores,
      });

      logger.info({ sessionCode, playerCount: sessionState.players.size }, "Session ended");
    } catch (error) {
      logger.error({ error }, "Error ending session");
      socket.emit("error", { message: "Failed to end session" });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Client disconnected");

    // Remove player from all sessions
    sessions.forEach((sessionState, sessionCode) => {
      if (sessionState.players.has(socket.id)) {
        const player = sessionState.players.get(socket.id)!;
        sessionState.players.delete(socket.id);

        // Notify others
        socket.to(sessionCode).emit(WSMessageType.PLAYER_LEFT, {
          playerId: socket.id,
          name: player.name,
        });

        logger.info({ sessionCode, playerId: socket.id, remainingPlayers: sessionState.players.size }, "Player left");

        // If host left, clear host
        if (sessionState.hostSocketId === socket.id) {
          sessionState.hostSocketId = null;
          logger.info({ sessionCode }, "Host disconnected");
        }

        // Clean up empty sessions after 5 minutes
        if (sessionState.players.size === 0) {
          setTimeout(() => {
            if (sessionState.players.size === 0) {
              sessions.delete(sessionCode);
              logger.info({ sessionCode }, "Empty session cleaned up");
            }
          }, 5 * 60 * 1000);
        }
      }
    });
  });
});

// Health check endpoint
httpServer.on("request", (req, res) => {
  if (req.url === "/healthz" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size,
        totalPlayers: Array.from(sessions.values()).reduce((sum, s) => sum + s.players.size, 0),
      })
    );
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
