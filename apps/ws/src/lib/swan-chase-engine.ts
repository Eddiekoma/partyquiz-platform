import {
  SwanChaseGameState,
  SwanChasePlayer,
  SwanChaseSettings,
  SwanChaseMode,
  SwanChaseTeam,
  SwanChasePlayerStatus,
  Vector2D,
  SafeZone,
  Obstacle,
} from "@partyquiz/shared";

interface AISwanState {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  rotation: number;
  targetPlayerId?: string;
  speed: number;
}

/**
 * Swan Chase Game Engine
 * 
 * Server-authoritative physics engine for the Swan Chase game mode.
 * Handles 30 FPS physics loop, collision detection, team assignment,
 * and win condition checking.
 * 
 * Supports 4 game modes:
 * - CLASSIC: Boats vs Swans, single round
 * - ROUNDS: 2 rounds with team swap
 * - KING_OF_LAKE: Free-for-all, everyone can tag everyone, last standing wins
 * - SWAN_SWARM: Co-op survival, all players vs AI swans
 */
export class SwanChaseGameEngine {
  private gameState: SwanChaseGameState;
  private physicsInterval: NodeJS.Timeout | null = null;
  private readonly PHYSICS_FPS = 30;
  private readonly PHYSICS_DELTA = 1000 / 30; // ~33ms
  
  // AI swan tracking (SWAN_SWARM mode)
  private aiSwans: AISwanState[] = [];
  private waveTimer: NodeJS.Timeout | null = null;
  private currentWave: number = 0;
  
  // King of Lake tracking
  private kingInvulnerableUntil: number = 0;
  
  // Local tracking for physics properties not in shared types
  private playerPhysics: Map<string, {
    speed: number;
    isMoving: boolean;
  }> = new Map();

  constructor(
    sessionCode: string,
    mode: SwanChaseMode,
    playerIds: string[],
    playerNames: Map<string, string>,
    customDuration?: number,
    teamAssignments?: Array<{ playerId: string; team: "BLUE" | "WHITE" }>
  ) {
    const playerCount = playerIds.length;
    const settings = this.generateGameSettings(playerCount, mode, customDuration);
    const teams = (mode === SwanChaseMode.KING_OF_LAKE || mode === SwanChaseMode.SWAN_SWARM)
      ? this.assignTeams(playerIds, mode) // No custom teams for these modes
      : teamAssignments 
        ? this.assignTeamsFromConfig(teamAssignments)
        : this.assignTeams(playerIds, mode);

    // Initialize players
    const players: SwanChasePlayer[] = playerIds.map((id) => {
      const team = teams.get(id)!;
      const playerType = this.getPlayerType(team, mode);
      const playerStatus = this.getInitialStatus(team, mode);
      const position = this.getStartPosition(team, teams, settings, mode);

      // Initialize local physics tracking
      this.playerPhysics.set(id, {
        speed: 0,
        isMoving: false,
      });

      return {
        id,
        name: playerNames.get(id) || `Player ${id.slice(0, 4)}`,
        avatar: null,
        team,
        type: playerType,
        status: playerStatus,
        position,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        score: 0,
        tagsCount: (team === SwanChaseTeam.WHITE) ? 0 : undefined,
        abilities: {
          sprint: {
            charges: mode === SwanChaseMode.KING_OF_LAKE ? 5 : 3,
            active: false,
            cooldownUntil: 0,
          },
          // KING_OF_LAKE: everyone gets dash; CLASSIC/ROUNDS: only swans; SWAN_SWARM: no dash (boats only)
          dash: (mode === SwanChaseMode.KING_OF_LAKE || team === SwanChaseTeam.WHITE)
            ? {
                charges: mode === SwanChaseMode.KING_OF_LAKE ? 3 : 1,
                active: false,
                cooldownUntil: 0,
              }
            : undefined,
        },
      };
    });

    // Initialize AI swans for SWAN_SWARM mode
    if (mode === SwanChaseMode.SWAN_SWARM) {
      this.currentWave = 1;
      this.aiSwans = this.spawnAIWave(1, settings);
    }

    this.gameState = {
      mode,
      sessionCode,
      round: 1,
      status: 'COUNTDOWN',
      startTime: Date.now(),
      timeRemaining: settings.duration,
      settings,
      players,
      // KING_OF_LAKE: random first king
      currentKingId: mode === SwanChaseMode.KING_OF_LAKE
        ? playerIds[Math.floor(Math.random() * playerIds.length)]
        : undefined,
      // SWAN_SWARM: AI state
      aiSwans: mode === SwanChaseMode.SWAN_SWARM ? this.aiSwans : undefined,
      currentWave: mode === SwanChaseMode.SWAN_SWARM ? 1 : undefined,
      playersAlive: mode === SwanChaseMode.SWAN_SWARM ? playerCount : undefined,
      winner: null,
      winConditionMet: false,
    };

    // Set initial king status
    if (mode === SwanChaseMode.KING_OF_LAKE && this.gameState.currentKingId) {
      const king = players.find(p => p.id === this.gameState.currentKingId);
      if (king) {
        king.status = SwanChasePlayerStatus.KING;
        this.kingInvulnerableUntil = Date.now() + (settings.kingInvulnerabilityMs || 3000);
      }
    }
  }

  /**
   * Determine player type based on team and mode
   */
  private getPlayerType(team: SwanChaseTeam, mode: SwanChaseMode): 'BOAT' | 'SWAN' {
    if (mode === SwanChaseMode.KING_OF_LAKE) return 'BOAT'; // Everyone is a "boat" in free-for-all
    if (mode === SwanChaseMode.SWAN_SWARM) return 'BOAT';   // All players are boats vs AI swans
    return team === SwanChaseTeam.BLUE ? 'BOAT' : 'SWAN';
  }

  /**
   * Determine initial player status based on team and mode
   */
  private getInitialStatus(team: SwanChaseTeam, mode: SwanChaseMode): SwanChasePlayerStatus {
    if (mode === SwanChaseMode.KING_OF_LAKE) return SwanChasePlayerStatus.ACTIVE; // King set separately
    if (mode === SwanChaseMode.SWAN_SWARM) return SwanChasePlayerStatus.ACTIVE;
    return team === SwanChaseTeam.BLUE ? SwanChasePlayerStatus.ACTIVE : SwanChasePlayerStatus.HUNTING;
  }

  /**
   * Generate game settings based on player count and mode
   */
  private generateGameSettings(playerCount: number, mode: SwanChaseMode, customDuration?: number): SwanChaseSettings {
    const width = 1600;
    const height = 900;

    // Generate obstacles
    const obstacleCount = Math.min(3 + Math.floor(playerCount / 3), 8);
    const obstacles: Obstacle[] = [];
    for (let i = 0; i < obstacleCount; i++) {
      obstacles.push({
        id: `obstacle_${i}`,
        position: {
          x: 300 + Math.random() * (width - 600),
          y: 200 + Math.random() * (height - 400),
        },
        radius: 30 + Math.random() * 30,
        type: Math.random() > 0.5 ? 'ROCK' : 'ISLAND',
      });
    }

    if (mode === SwanChaseMode.KING_OF_LAKE) {
      // Free-for-all: everyone is a "boat" that can tag others
      const duration = customDuration || 90; // Longer: last one standing
      return {
        totalPlayers: playerCount,
        boatsCount: playerCount, // All players are boats
        swansCount: 0,
        duration,
        gameArea: { width, height },
        safeZone: {
          position: { x: -1000, y: -1000 }, // No safe zone
          radius: 0,
        },
        speeds: {
          boat: 5.0,
          boatSprint: 7.5,
          swan: 5.5,    // Used by king when chasing
          swanDash: 9.0, // Used by king dash
        },
        tagRange: 45, // Slightly larger for more action
        obstacles,
        kingInvulnerabilityMs: 3000, // 3s invulnerability after becoming king
      };
    }

    if (mode === SwanChaseMode.SWAN_SWARM) {
      // Co-op survival: all players are boats, AI swans chase them
      const duration = customDuration || 120; // 2 min survival challenge
      const aiSwanCount = Math.max(2, Math.ceil(playerCount * 0.5)); // Start with half player count
      return {
        totalPlayers: playerCount,
        boatsCount: playerCount,
        swansCount: 0, // No player swans
        duration,
        gameArea: { width, height },
        safeZone: {
          position: { x: width / 2, y: height / 2 }, // Central safe zone (brief respite)
          radius: 100,
        },
        speeds: {
          boat: 5.0,
          boatSprint: 7.5,
          swan: 4.5,    // AI swans base speed (slightly slower)
          swanDash: 7.0, // AI swans can burst
        },
        tagRange: 40,
        obstacles,
        aiSwanCount,
        aiSwanSpeed: 1.0,
        waveInterval: 20, // New wave every 20 seconds
      };
    }

    // CLASSIC and ROUNDS modes
    const boatsCount = Math.ceil(playerCount * 0.66);
    const swansCount = playerCount - boatsCount;
    const duration = customDuration || Math.round(45 + ((playerCount - 2) / 10) * 30);
    const safeZoneRadius = Math.round(180 - ((playerCount - 2) / 10) * 30);

    return {
      totalPlayers: playerCount,
      boatsCount,
      swansCount,
      duration,
      gameArea: { width, height },
      safeZone: {
        position: { x: width - 200, y: height / 2 },
        radius: safeZoneRadius,
      },
      speeds: {
        boat: 5.0,
        boatSprint: 7.5,
        swan: 5.5,
        swanDash: 9.0,
      },
      tagRange: 40,
      obstacles,
    };
  }

  /**
   * Assign players to teams based on mode and player count
   */
  private assignTeams(playerIds: string[], mode: SwanChaseMode): Map<string, SwanChaseTeam> {
    const teams = new Map<string, SwanChaseTeam>();
    const playerCount = playerIds.length;

    if (mode === SwanChaseMode.KING_OF_LAKE) {
      // Free-for-all: everyone is SOLO
      playerIds.forEach((id) => {
        teams.set(id, SwanChaseTeam.SOLO);
      });
    } else if (mode === SwanChaseMode.SWAN_SWARM) {
      // Co-op: everyone is COOP
      playerIds.forEach((id) => {
        teams.set(id, SwanChaseTeam.COOP);
      });
    } else {
      // CLASSIC and ROUNDS: ~66% boats, ~33% swans
      const boatCount = Math.ceil(playerCount * 0.66);
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      shuffled.forEach((id, index) => {
        teams.set(id, index < boatCount ? SwanChaseTeam.BLUE : SwanChaseTeam.WHITE);
      });
    }

    return teams;
  }

  /**
   * Assign teams from host configuration
   */
  private assignTeamsFromConfig(teamAssignments: Array<{ playerId: string; team: "BLUE" | "WHITE" }>): Map<string, SwanChaseTeam> {
    const teams = new Map<string, SwanChaseTeam>();
    
    for (const assignment of teamAssignments) {
      const team = assignment.team === "BLUE" ? SwanChaseTeam.BLUE : SwanChaseTeam.WHITE;
      teams.set(assignment.playerId, team);
    }
    
    return teams;
  }

  /**
   * Generate starting position for player
   */
  private getStartPosition(
    team: SwanChaseTeam,
    teams: Map<string, SwanChaseTeam>,
    settings: SwanChaseSettings,
    mode: SwanChaseMode
  ): Vector2D {
    const { width, height } = settings.gameArea;

    if (mode === SwanChaseMode.KING_OF_LAKE) {
      // Spread all players evenly around the map edges
      const playerCount = teams.size;
      const index = Array.from(teams.values()).filter(t => t === SwanChaseTeam.SOLO).length;
      const angle = (index / playerCount) * Math.PI * 2;
      const rx = width * 0.35;
      const ry = height * 0.35;
      return {
        x: width / 2 + Math.cos(angle) * rx,
        y: height / 2 + Math.sin(angle) * ry,
      };
    }

    if (mode === SwanChaseMode.SWAN_SWARM) {
      // All players start in center cluster
      return {
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: height / 2 + (Math.random() - 0.5) * 200,
      };
    }

    // CLASSIC / ROUNDS
    const isBoat = team === SwanChaseTeam.BLUE;
    if (isBoat) {
      // Boats start on left side
      const boatPlayers = Array.from(teams.values()).filter(t => t === SwanChaseTeam.BLUE).length;
      const boatIndex = Array.from(teams.entries())
        .filter(([_, t]) => t === SwanChaseTeam.BLUE)
        .length;
      return {
        x: 150 + Math.random() * 50,
        y: (height / (boatPlayers + 1)) * (boatIndex + 1) + (Math.random() - 0.5) * 50,
      };
    } else {
      // Swans start in center
      return {
        x: width / 2 + (Math.random() - 0.5) * 150,
        y: height / 2 + (Math.random() - 0.5) * 150,
      };
    }
  }

  /**
   * Start the physics loop
   */
  public start(onStateUpdate: (state: SwanChaseGameState) => void): void {
    // 3-second countdown
    setTimeout(() => {
      this.gameState.status = 'ACTIVE';
      this.gameState.startTime = Date.now();

      this.physicsInterval = setInterval(() => {
        this.updatePhysics();
        this.checkWinConditions();
        onStateUpdate(this.gameState);

        // Check if time expired
        if (this.gameState.timeRemaining <= 0 && this.gameState.status === 'ACTIVE') {
          if (this.gameState.mode === SwanChaseMode.KING_OF_LAKE) {
            // Time up: current king wins
            this.endGameWithWinner(
              this.gameState.currentKingId || null,
              'TIME_UP_KING_WINS'
            );
          } else if (this.gameState.mode === SwanChaseMode.SWAN_SWARM) {
            // Survived! All remaining players win
            this.endGame(SwanChaseTeam.COOP, 'SURVIVED_ALL_WAVES');
          } else {
            // Boats win by timeout
            this.endGame(SwanChaseTeam.BLUE, 'TIME_SURVIVED');
          }
        }
      }, this.PHYSICS_DELTA);

      // SWAN_SWARM: Start wave spawning timer
      if (this.gameState.mode === SwanChaseMode.SWAN_SWARM) {
        const interval = (this.gameState.settings.waveInterval || 20) * 1000;
        this.waveTimer = setInterval(() => {
          if (this.gameState.status !== 'ACTIVE') return;
          this.currentWave++;
          const newSwans = this.spawnAIWave(this.currentWave, this.gameState.settings);
          this.aiSwans.push(...newSwans);
          this.gameState.aiSwans = [...this.aiSwans];
          this.gameState.currentWave = this.currentWave;
          console.log(`[SwanChase] SWAN_SWARM wave ${this.currentWave} spawned (${newSwans.length} new AI swans, total: ${this.aiSwans.length})`);
        }, interval);
      }
    }, 3000);
  }

  /**
   * Stop the physics loop
   */
  public stop(): void {
    if (this.physicsInterval) {
      clearInterval(this.physicsInterval);
      this.physicsInterval = null;
    }
    if (this.waveTimer) {
      clearInterval(this.waveTimer);
      this.waveTimer = null;
    }
  }

  /**
   * Handle player input
   */
  public handleInput(playerId: string, input: {
    direction: Vector2D;
    sprint?: boolean;
    dash?: boolean;
  }): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || this.gameState.status !== 'ACTIVE') return;

    // Ignore input from eliminated/tagged/safe players
    if (player.status === SwanChasePlayerStatus.TAGGED || 
        player.status === SwanChasePlayerStatus.SAFE ||
        player.status === SwanChasePlayerStatus.ELIMINATED) {
      return;
    }

    const physics = this.playerPhysics.get(playerId)!;
    const now = Date.now();

    // Determine base characteristics based on mode
    const mode = this.gameState.mode;
    const isKing = mode === SwanChaseMode.KING_OF_LAKE && this.gameState.currentKingId === playerId;
    const isBoatLike = player.team === SwanChaseTeam.BLUE || 
                       player.team === SwanChaseTeam.COOP || 
                       player.team === SwanChaseTeam.SOLO;

    // Update velocity based on direction
    const magnitude = Math.sqrt(input.direction.x ** 2 + input.direction.y ** 2);
    if (magnitude > 0) {
      const normalized = {
        x: input.direction.x / magnitude,
        y: input.direction.y / magnitude,
      };

      player.rotation = Math.atan2(normalized.y, normalized.x);

      // Determine speed
      let speed = isKing
        ? this.gameState.settings.speeds.swan  // King is slightly faster (hunter speed)
        : this.gameState.settings.speeds.boat;

      // Handle dash
      if (input.dash && player.abilities.dash) {
        if (now >= player.abilities.dash.cooldownUntil && player.abilities.dash.charges > 0) {
          player.abilities.dash.active = true;
          player.abilities.dash.charges--;
          player.abilities.dash.cooldownUntil = now + 4000;
          if (player.status !== SwanChasePlayerStatus.KING) {
            player.status = SwanChasePlayerStatus.DASHING;
          }
          speed = this.gameState.settings.speeds.swanDash;
          
          setTimeout(() => {
            if (player.abilities.dash) {
              player.abilities.dash.active = false;
            }
            if (player.status === SwanChasePlayerStatus.DASHING) {
              // Restore appropriate status
              if (mode === SwanChaseMode.KING_OF_LAKE) {
                player.status = SwanChasePlayerStatus.ACTIVE;
              } else {
                player.status = SwanChasePlayerStatus.HUNTING;
              }
            }
          }, 1000);
        }
      }

      // Handle sprint
      if (input.sprint && player.abilities.sprint) {
        if (now >= player.abilities.sprint.cooldownUntil && player.abilities.sprint.charges > 0) {
          player.abilities.sprint.active = true;
          player.abilities.sprint.charges--;
          player.abilities.sprint.cooldownUntil = now + 3000;
          speed = this.gameState.settings.speeds.boatSprint;
          
          setTimeout(() => {
            player.abilities.sprint.active = false;
          }, 2000);
        } else if (player.abilities.sprint.active) {
          speed = this.gameState.settings.speeds.boatSprint;
        }
      }

      physics.speed = speed;
      physics.isMoving = true;

      player.velocity = {
        x: normalized.x * speed,
        y: normalized.y * speed,
      };
    } else {
      player.velocity = { x: 0, y: 0 };
      physics.speed = 0;
      physics.isMoving = false;
    }
  }

  /**
   * Update physics for one frame
   */
  private updatePhysics(): void {
    const { settings, players, mode } = this.gameState;

    // Update timer
    const elapsed = Date.now() - this.gameState.startTime;
    this.gameState.timeRemaining = Math.max(0, settings.duration - Math.floor(elapsed / 1000));

    // Update player positions
    players.forEach((player) => {
      if (player.status === SwanChasePlayerStatus.TAGGED || 
          player.status === SwanChasePlayerStatus.SAFE ||
          player.status === SwanChasePlayerStatus.ELIMINATED) {
        return;
      }

      // Update position
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;

      // Clamp to map bounds
      player.position.x = Math.max(50, Math.min(settings.gameArea.width - 50, player.position.x));
      player.position.y = Math.max(50, Math.min(settings.gameArea.height - 50, player.position.y));

      // Check safe zone entry (CLASSIC/ROUNDS: boats only; SWAN_SWARM: temp respite)
      if (mode !== SwanChaseMode.KING_OF_LAKE && settings.safeZone.radius > 0) {
        if ((player.team === SwanChaseTeam.BLUE) && player.status === SwanChasePlayerStatus.ACTIVE) {
          const distToSafe = this.distance(player.position, settings.safeZone.position);
          if (distToSafe < settings.safeZone.radius) {
            if (mode === SwanChaseMode.SWAN_SWARM) {
              // In SWAN_SWARM, safe zone gives brief respite but doesn't end game
              // Just give points for being in zone
              player.score += 1;
            } else {
              player.status = SwanChasePlayerStatus.SAFE;
              player.velocity = { x: 0, y: 0 };
              player.score += 100;
            }
          }
        }
      }

      // Check collisions with obstacles
      settings.obstacles.forEach((obstacle) => {
        const dist = this.distance(player.position, obstacle.position);
        if (dist < obstacle.radius + 20) {
          const angle = Math.atan2(
            player.position.y - obstacle.position.y,
            player.position.x - obstacle.position.x
          );
          player.position.x = obstacle.position.x + Math.cos(angle) * (obstacle.radius + 20);
          player.position.y = obstacle.position.y + Math.sin(angle) * (obstacle.radius + 20);
        }
      });
    });

    // Update AI swans for SWAN_SWARM mode
    if (mode === SwanChaseMode.SWAN_SWARM) {
      this.updateAISwans();
    }

    // Check tagging collisions
    this.checkTagging();
  }

  /**
   * Update AI swan positions and behavior (SWAN_SWARM mode)
   */
  private updateAISwans(): void {
    const { settings, players } = this.gameState;
    const activePlayers = players.filter(p => 
      p.status === SwanChasePlayerStatus.ACTIVE || 
      p.status === SwanChasePlayerStatus.DASHING
    );

    if (activePlayers.length === 0) return;

    this.aiSwans.forEach((ai) => {
      // Find nearest active player or chase assigned target
      let target = activePlayers.find(p => p.id === ai.targetPlayerId);
      if (!target) {
        // Reassign to nearest player
        let minDist = Infinity;
        activePlayers.forEach(p => {
          const d = this.distance(ai.position, p.position);
          if (d < minDist) {
            minDist = d;
            target = p;
          }
        });
        if (target) {
          ai.targetPlayerId = target.id;
        }
      }

      if (!target) return;

      // Move toward target
      const dx = target.position.x - ai.position.x;
      const dy = target.position.y - ai.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const speed = ai.speed;
        ai.velocity = {
          x: (dx / dist) * speed,
          y: (dy / dist) * speed,
        };
        ai.rotation = Math.atan2(dy, dx);
      }

      // Update position
      ai.position.x += ai.velocity.x;
      ai.position.y += ai.velocity.y;

      // Clamp to bounds
      ai.position.x = Math.max(30, Math.min(settings.gameArea.width - 30, ai.position.x));
      ai.position.y = Math.max(30, Math.min(settings.gameArea.height - 30, ai.position.y));

      // Obstacle avoidance
      settings.obstacles.forEach((obstacle) => {
        const d = this.distance(ai.position, obstacle.position);
        if (d < obstacle.radius + 15) {
          const angle = Math.atan2(
            ai.position.y - obstacle.position.y,
            ai.position.x - obstacle.position.x
          );
          ai.position.x = obstacle.position.x + Math.cos(angle) * (obstacle.radius + 15);
          ai.position.y = obstacle.position.y + Math.sin(angle) * (obstacle.radius + 15);
        }
      });
    });

    // Update game state with AI positions
    this.gameState.aiSwans = this.aiSwans.map(ai => ({
      id: ai.id,
      position: { ...ai.position },
      velocity: { ...ai.velocity },
      rotation: ai.rotation,
      targetPlayerId: ai.targetPlayerId,
    }));
  }

  /**
   * Spawn a wave of AI swans (SWAN_SWARM mode)
   */
  private spawnAIWave(waveNumber: number, settings: SwanChaseSettings): AISwanState[] {
    const baseCount = settings.aiSwanCount || 2;
    const count = baseCount + Math.floor(waveNumber * 0.5); // More swans each wave
    const baseSpeed = (settings.aiSwanSpeed || 1.0) * settings.speeds.swan;
    const speedMultiplier = 1 + (waveNumber - 1) * 0.1; // 10% faster each wave

    const swans: AISwanState[] = [];
    const { width, height } = settings.gameArea;

    for (let i = 0; i < count; i++) {
      // Spawn from edges
      const edge = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (edge) {
        case 0: x = 20; y = Math.random() * height; break;           // left
        case 1: x = width - 20; y = Math.random() * height; break;   // right
        case 2: x = Math.random() * width; y = 20; break;            // top
        default: x = Math.random() * width; y = height - 20; break;  // bottom
      }

      swans.push({
        id: `ai_w${waveNumber}_${i}`,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        targetPlayerId: undefined,
        speed: baseSpeed * speedMultiplier,
      });
    }

    return swans;
  }

  /**
   * Check for tagging collisions
   */
  private checkTagging(): void {
    const { players, settings, mode } = this.gameState;

    if (mode === SwanChaseMode.KING_OF_LAKE) {
      this.checkKingOfLakeTagging();
      return;
    }

    if (mode === SwanChaseMode.SWAN_SWARM) {
      this.checkSwanSwarmTagging();
      return;
    }

    // CLASSIC / ROUNDS: swans tag boats
    const boats = players.filter(p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.ACTIVE);
    const swans = players.filter(p => p.team === SwanChaseTeam.WHITE && 
      (p.status === SwanChasePlayerStatus.HUNTING || p.status === SwanChasePlayerStatus.DASHING));

    boats.forEach((boat) => {
      swans.forEach((swan) => {
        const dist = this.distance(boat.position, swan.position);
        if (dist < settings.tagRange) {
          boat.status = SwanChasePlayerStatus.TAGGED;
          boat.velocity = { x: 0, y: 0 };
          swan.tagsCount = (swan.tagsCount || 0) + 1;
          swan.score += 50;
        }
      });
    });
  }

  /**
   * KING_OF_LAKE: The king chases everyone. If king tags someone, that person is eliminated.
   * If a non-king tags the king (while king is not invulnerable), that person becomes the new king.
   */
  private checkKingOfLakeTagging(): void {
    const { players, settings } = this.gameState;
    const now = Date.now();
    const kingId = this.gameState.currentKingId;
    if (!kingId) return;

    const king = players.find(p => p.id === kingId);
    if (!king || king.status === SwanChasePlayerStatus.ELIMINATED) return;

    const activePlayers = players.filter(p => 
      p.id !== kingId && 
      p.status === SwanChasePlayerStatus.ACTIVE || p.status === SwanChasePlayerStatus.DASHING
    );

    const isKingInvulnerable = now < this.kingInvulnerableUntil;

    activePlayers.forEach((player) => {
      if (player.id === kingId) return;
      const dist = this.distance(king.position, player.position);
      if (dist < settings.tagRange) {
        // King tags a player -> player eliminated
        player.status = SwanChasePlayerStatus.ELIMINATED;
        player.velocity = { x: 0, y: 0 };
        king.score += 100;
        king.tagsCount = (king.tagsCount || 0) + 1;
        
        console.log(`[SwanChase] KING_OF_LAKE: ${king.name} eliminated ${player.name}`);
      }
    });

    // Check if someone bumps the king (non-invulnerable) - they become new king
    if (!isKingInvulnerable) {
      for (const player of activePlayers) {
        if (player.status === SwanChasePlayerStatus.ELIMINATED) continue;
        const dist = this.distance(player.position, king.position);
        // Players need to dash into king to steal crown (closer range required)
        if (dist < settings.tagRange * 0.7 && player.status === SwanChasePlayerStatus.DASHING) {
          // Crown stolen!
          king.status = SwanChasePlayerStatus.ACTIVE;
          player.status = SwanChasePlayerStatus.KING;
          this.gameState.currentKingId = player.id;
          this.kingInvulnerableUntil = now + (settings.kingInvulnerabilityMs || 3000);
          player.score += 200;
          
          console.log(`[SwanChase] KING_OF_LAKE: ${player.name} stole the crown from ${king.name}!`);
          break; // Only one crown steal per frame
        }
      }
    }
  }

  /**
   * SWAN_SWARM: AI swans tag player boats
   */
  private checkSwanSwarmTagging(): void {
    const { players, settings } = this.gameState;
    const activePlayers = players.filter(p => 
      p.status === SwanChasePlayerStatus.ACTIVE || 
      p.status === SwanChasePlayerStatus.DASHING
    );

    this.aiSwans.forEach((ai) => {
      activePlayers.forEach((player) => {
        const dist = this.distance(ai.position, player.position);
        if (dist < settings.tagRange) {
          // Player tagged by AI swan
          player.status = SwanChasePlayerStatus.TAGGED;
          player.velocity = { x: 0, y: 0 };
          
          // Update alive count
          this.gameState.playersAlive = players.filter(p => 
            p.status === SwanChasePlayerStatus.ACTIVE || 
            p.status === SwanChasePlayerStatus.DASHING
          ).length;
          
          console.log(`[SwanChase] SWAN_SWARM: ${player.name} was caught! (${this.gameState.playersAlive} alive)`);
        }
      });
    });
  }

  /**
   * Check win conditions
   */
  private checkWinConditions(): void {
    if (this.gameState.status !== 'ACTIVE' || this.gameState.winConditionMet) return;

    const { mode, players } = this.gameState;

    if (mode === SwanChaseMode.KING_OF_LAKE) {
      // Last player standing wins (excluding eliminated)
      const alive = players.filter(p => 
        p.status !== SwanChasePlayerStatus.ELIMINATED
      );

      if (alive.length <= 1) {
        const winner = alive[0];
        this.endGameWithWinner(winner?.id || null, 'LAST_STANDING');
        return;
      }
      // Also check: if only king remains active
      const nonKingAlive = alive.filter(p => p.id !== this.gameState.currentKingId);
      if (nonKingAlive.length === 0) {
        this.endGameWithWinner(this.gameState.currentKingId || null, 'ALL_ELIMINATED');
        return;
      }
      return;
    }

    if (mode === SwanChaseMode.SWAN_SWARM) {
      // All players tagged = swans win (game over)
      const activePlayers = players.filter(p => 
        p.status === SwanChasePlayerStatus.ACTIVE || 
        p.status === SwanChasePlayerStatus.DASHING
      );

      if (activePlayers.length === 0) {
        this.endGame(SwanChaseTeam.AI, 'ALL_CAUGHT');
        return;
      }
      // If time runs out, surviving players win (handled in start())
      return;
    }

    // CLASSIC / ROUNDS
    const boats = players.filter(p => p.team === SwanChaseTeam.BLUE);
    const activeBoats = boats.filter(p => p.status === SwanChasePlayerStatus.ACTIVE);
    const safeBoats = boats.filter(p => p.status === SwanChasePlayerStatus.SAFE);

    // Boats win if at least one reaches safe zone
    if (safeBoats.length > 0) {
      this.endGame(SwanChaseTeam.BLUE, 'REACHED_SAFE_ZONE');
      return;
    }

    // Swans win if all boats are tagged
    if (activeBoats.length === 0 && safeBoats.length === 0) {
      this.endGame(SwanChaseTeam.WHITE, 'ALL_BOATS_TAGGED');
      return;
    }

    // Boats win if time runs out and at least one is still active
    if (this.gameState.timeRemaining === 0 && activeBoats.length > 0) {
      this.endGame(SwanChaseTeam.BLUE, 'TIME_SURVIVED');
      return;
    }
  }

  /**
   * End the game with a team winner
   */
  private endGame(winner: SwanChaseTeam, reason: string): void {
    this.gameState.status = 'ENDED';
    this.gameState.winner = winner;
    this.gameState.winConditionMet = true;
    this.stop();

    console.log(`[SwanChase] Game ended: ${winner} wins (${reason})`);
  }

  /**
   * End the game with an individual winner (KING_OF_LAKE)
   */
  private endGameWithWinner(winnerId: string | null, reason: string): void {
    this.gameState.status = 'ENDED';
    this.gameState.winner = SwanChaseTeam.SOLO; // Individual winner
    this.gameState.winnerId = winnerId;
    this.gameState.winConditionMet = true;
    this.stop();

    const winnerPlayer = winnerId ? this.gameState.players.find(p => p.id === winnerId) : null;
    console.log(`[SwanChase] KING_OF_LAKE ended: ${winnerPlayer?.name || 'No one'} wins (${reason})`);
  }

  /**
   * Calculate distance between two points
   */
  private distance(a: Vector2D, b: Vector2D): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  /**
   * Get current game state
   */
  public getState(): SwanChaseGameState {
    return { ...this.gameState };
  }

  /**
   * Get player by ID
   */
  public getPlayer(playerId: string): SwanChasePlayer | undefined {
    return this.gameState.players.find(p => p.id === playerId);
  }
}
