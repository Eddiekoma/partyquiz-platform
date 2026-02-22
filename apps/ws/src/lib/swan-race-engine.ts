/**
 * Swan Race Engine - Server-authoritative race mode
 *
 * A proper engine class (like SwanChaseGameEngine) that outputs
 * SwanChaseGameState format for seamless integration with the
 * display and event infrastructure.
 *
 * Physics: stroke-based paddling with velocity decay over time.
 * Players race left-to-right across lanes, first to finish wins.
 */

import {
  SwanChaseMode,
  SwanChaseTeam,
  SwanChasePlayerStatus,
  type SwanChasePlayer,
  type SwanChaseGameState,
  type SwanChaseSettings,
  type Vector2D,
} from "@partyquiz/shared";

const RACE_DEFAULTS = {
  TRACK_LENGTH: 1400,        // px (within 1600 game area)
  START_X: 100,              // offset from left edge
  LANE_PADDING: 60,          // top/bottom padding for lanes
  GAME_AREA_WIDTH: 1600,
  GAME_AREA_HEIGHT: 900,
  FINISH_LINE: 1500,         // x position of finish line
  MAX_DURATION: 60,          // seconds
  COUNTDOWN_SEC: 3,
  TICK_RATE: 30,             // Hz
  // Stroke physics
  STROKE_POWER_MAX: 12,      // max velocity added per stroke
  STROKE_DURATION_CAP: 300,  // ms (holds longer than this don't help)
  VELOCITY_DECAY: 0.96,      // per-tick multiplier (friction)
  VELOCITY_MIN: 0.1,         // below this, set to 0
  SPRINT_COOLDOWN_MS: 3000,
  SPRINT_DURATION_MS: 1000,
  SPRINT_MULTIPLIER: 1.8,
};

interface RacePlayerState {
  id: string;
  name: string;
  avatar?: string | null;
  laneIndex: number;          // 0-based lane number
  position: number;           // x progress (0 = start, FINISH_LINE = end)
  velocity: number;           // px/tick
  lastStrokeTime: number;
  finished: boolean;
  finishOrder: number | null;  // 1-based finish position
  sprintActive: boolean;
  sprintCooldownUntil: number;
}

export class SwanRaceEngine {
  private sessionCode: string;
  private players: Map<string, RacePlayerState> = new Map();
  private startTime: number = 0;
  private countdownEndTime: number = 0;
  private status: "COUNTDOWN" | "ACTIVE" | "ENDED" = "COUNTDOWN";
  private finishOrder: string[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastFn: ((state: SwanChaseGameState) => void) | null = null;
  private onEndFn: ((results: RaceResults) => void) | null = null;
  private duration: number;

  constructor(
    sessionCode: string,
    playerIds: string[],
    playerNames: string[],
    playerAvatars: (string | null)[],
    duration: number = RACE_DEFAULTS.MAX_DURATION,
  ) {
    this.sessionCode = sessionCode;
    this.duration = Math.min(duration, RACE_DEFAULTS.MAX_DURATION);

    const laneCount = playerIds.length;
    const laneHeight =
      (RACE_DEFAULTS.GAME_AREA_HEIGHT - 2 * RACE_DEFAULTS.LANE_PADDING) / laneCount;

    playerIds.forEach((id, idx) => {
      this.players.set(id, {
        id,
        name: playerNames[idx] || `Player ${idx + 1}`,
        avatar: playerAvatars[idx] || null,
        laneIndex: idx,
        position: 0,
        velocity: 0,
        lastStrokeTime: 0,
        finished: false,
        finishOrder: null,
        sprintActive: false,
        sprintCooldownUntil: 0,
      });
    });
  }

  /**
   * Start the race with a countdown
   */
  start(
    broadcast: (state: SwanChaseGameState) => void,
    onEnd: (results: RaceResults) => void,
  ): void {
    this.broadcastFn = broadcast;
    this.onEndFn = onEnd;
    this.startTime = Date.now() + RACE_DEFAULTS.COUNTDOWN_SEC * 1000;
    this.countdownEndTime = this.startTime;
    this.status = "COUNTDOWN";

    // Broadcast initial state
    this.broadcast();

    // Start tick loop
    this.tickInterval = setInterval(() => this.tick(), 1000 / RACE_DEFAULTS.TICK_RATE);
  }

  /**
   * Handle a player stroke input
   */
  handleStroke(playerId: string, strokeDuration: number): void {
    if (this.status !== "ACTIVE") return;

    const player = this.players.get(playerId);
    if (!player || player.finished) return;

    const now = Date.now();

    // Calculate stroke power: longer hold = more power, capped
    const normalizedDuration = Math.min(strokeDuration, RACE_DEFAULTS.STROKE_DURATION_CAP);
    const strokePower = (normalizedDuration / RACE_DEFAULTS.STROKE_DURATION_CAP) * RACE_DEFAULTS.STROKE_POWER_MAX;

    // Add velocity
    const sprintMult = player.sprintActive ? RACE_DEFAULTS.SPRINT_MULTIPLIER : 1;
    player.velocity += strokePower * sprintMult;
    player.lastStrokeTime = now;
  }

  /**
   * Handle sprint activation
   */
  handleSprint(playerId: string): void {
    if (this.status !== "ACTIVE") return;

    const player = this.players.get(playerId);
    if (!player || player.finished) return;

    const now = Date.now();
    if (now < player.sprintCooldownUntil || player.sprintActive) return;

    player.sprintActive = true;
    player.sprintCooldownUntil = now + RACE_DEFAULTS.SPRINT_DURATION_MS + RACE_DEFAULTS.SPRINT_COOLDOWN_MS;

    // Auto-deactivate sprint after duration
    setTimeout(() => {
      player.sprintActive = false;
    }, RACE_DEFAULTS.SPRINT_DURATION_MS);
  }

  /**
   * Main tick - runs at 30 Hz
   */
  private tick(): void {
    const now = Date.now();

    // Handle countdown
    if (this.status === "COUNTDOWN") {
      if (now >= this.countdownEndTime) {
        this.status = "ACTIVE";
      }
      this.broadcast();
      return;
    }

    // Check time limit
    const elapsed = (now - this.startTime) / 1000;
    if (elapsed >= this.duration) {
      this.endRace();
      return;
    }

    // Update physics for each player
    for (const player of this.players.values()) {
      if (player.finished) continue;

      // Apply velocity decay (friction)
      player.velocity *= RACE_DEFAULTS.VELOCITY_DECAY;
      if (Math.abs(player.velocity) < RACE_DEFAULTS.VELOCITY_MIN) {
        player.velocity = 0;
      }

      // Update position
      player.position += player.velocity;
      player.position = Math.max(0, player.position);

      // Check finish line
      if (player.position >= RACE_DEFAULTS.FINISH_LINE - RACE_DEFAULTS.START_X) {
        player.position = RACE_DEFAULTS.FINISH_LINE - RACE_DEFAULTS.START_X;
        player.finished = true;
        player.velocity = 0;
        this.finishOrder.push(player.id);
        player.finishOrder = this.finishOrder.length;
      }
    }

    // Check if all players finished
    const allFinished = Array.from(this.players.values()).every((p) => p.finished);
    if (allFinished) {
      this.endRace();
      return;
    }

    this.broadcast();
  }

  /**
   * End the race and clean up
   */
  private endRace(): void {
    this.status = "ENDED";

    // Add any unfinished players to finish order (sorted by position)
    const unfinished = Array.from(this.players.values())
      .filter((p) => !p.finished)
      .sort((a, b) => b.position - a.position);

    for (const player of unfinished) {
      this.finishOrder.push(player.id);
      player.finishOrder = this.finishOrder.length;
    }

    this.broadcast();

    // Call onEnd callback with results
    if (this.onEndFn) {
      this.onEndFn({
        finishOrder: this.finishOrder,
        players: Array.from(this.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          finishOrder: p.finishOrder!,
          finished: p.finished,
        })),
      });
    }

    // Stop tick loop
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Force stop the race
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.status = "ENDED";
  }

  /**
   * Get the current game state in SwanChaseGameState format
   */
  getState(): SwanChaseGameState {
    const now = Date.now();
    const laneCount = this.players.size;
    const laneHeight =
      (RACE_DEFAULTS.GAME_AREA_HEIGHT - 2 * RACE_DEFAULTS.LANE_PADDING) / laneCount;

    const players: SwanChasePlayer[] = Array.from(this.players.values()).map((p) => {
      const laneY = RACE_DEFAULTS.LANE_PADDING + p.laneIndex * laneHeight + laneHeight / 2;
      const worldX = RACE_DEFAULTS.START_X + p.position;

      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        team: SwanChaseTeam.SOLO,
        type: "BOAT" as const,
        position: { x: worldX, y: laneY },
        velocity: { x: p.velocity, y: 0 },
        rotation: 90, // Facing right
        status: p.finished
          ? SwanChasePlayerStatus.SAFE
          : SwanChasePlayerStatus.ACTIVE,
        score: p.finishOrder
          ? Math.max(10 - (p.finishOrder - 1) * 2, 1)
          : 0,
        abilities: {
          sprint: {
            charges: 1,
            active: p.sprintActive,
            cooldownUntil: p.sprintCooldownUntil,
          },
        },
      };
    });

    const timeRemaining =
      this.status === "COUNTDOWN"
        ? this.duration
        : this.status === "ENDED"
        ? 0
        : Math.max(0, this.duration - (now - this.startTime) / 1000);

    // Winner = first to finish
    const winnerId = this.finishOrder.length > 0 ? this.finishOrder[0] : null;

    return {
      mode: SwanChaseMode.RACE,
      sessionCode: this.sessionCode,
      round: 1,
      status: this.status,
      startTime: this.startTime,
      timeRemaining,
      settings: {
        totalPlayers: this.players.size,
        boatsCount: this.players.size,
        swansCount: 0,
        duration: this.duration,
        gameArea: {
          width: RACE_DEFAULTS.GAME_AREA_WIDTH,
          height: RACE_DEFAULTS.GAME_AREA_HEIGHT,
        },
        safeZone: {
          // Finish line represented as safe zone (visual only)
          position: { x: RACE_DEFAULTS.FINISH_LINE, y: RACE_DEFAULTS.GAME_AREA_HEIGHT / 2 },
          radius: 50,
        },
        speeds: {
          boat: RACE_DEFAULTS.STROKE_POWER_MAX,
          boatSprint: RACE_DEFAULTS.STROKE_POWER_MAX * RACE_DEFAULTS.SPRINT_MULTIPLIER,
          swan: 0,
          swanDash: 0,
        },
        tagRange: 0,
        obstacles: [],
      },
      players,
      winner: this.status === "ENDED" && winnerId ? SwanChaseTeam.SOLO : null,
      winnerId: winnerId,
      winConditionMet: this.status === "ENDED",
    };
  }

  /**
   * Broadcast current state
   */
  private broadcast(): void {
    if (this.broadcastFn) {
      this.broadcastFn(this.getState());
    }
  }
}

export interface RaceResults {
  finishOrder: string[];
  players: Array<{
    id: string;
    name: string;
    finishOrder: number;
    finished: boolean;
  }>;
}
