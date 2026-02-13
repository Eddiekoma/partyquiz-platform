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

/**
 * Swan Chase Game Engine
 * 
 * Server-authoritative physics engine for the Swan Chase game mode.
 * Handles 30 FPS physics loop, collision detection, team assignment,
 * and win condition checking.
 */
export class SwanChaseGameEngine {
  private gameState: SwanChaseGameState;
  private physicsInterval: NodeJS.Timeout | null = null;
  private readonly PHYSICS_FPS = 30;
  private readonly PHYSICS_DELTA = 1000 / 30; // ~33ms
  
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
    const teams = teamAssignments 
      ? this.assignTeamsFromConfig(teamAssignments)
      : this.assignTeams(playerIds, mode);

    // Initialize players
    const players: SwanChasePlayer[] = playerIds.map((id) => {
      const team = teams.get(id)!;
      const isBoat = team === SwanChaseTeam.BLUE;
      const position = this.getStartPosition(isBoat, teams, settings);

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
        type: isBoat ? 'BOAT' : 'SWAN',
        status: isBoat ? SwanChasePlayerStatus.ACTIVE : SwanChasePlayerStatus.HUNTING,
        position,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        score: 0,
        tagsCount: isBoat ? undefined : 0,
        abilities: {
          sprint: {
            charges: 3,
            active: false,
            cooldownUntil: 0,
          },
          dash: isBoat ? undefined : {
            charges: 1,
            active: false,
            cooldownUntil: 0,
          },
        },
      };
    });

    this.gameState = {
      mode,
      sessionCode,
      round: 1,
      status: 'COUNTDOWN',
      startTime: Date.now(),
      timeRemaining: settings.duration,
      settings,
      players,
      winner: null,
      winConditionMet: false,
    };
  }

  /**
   * Generate game settings based on player count and mode
   */
  private generateGameSettings(playerCount: number, mode: SwanChaseMode, customDuration?: number): SwanChaseSettings {
    // Dynamic formulas based on player scaling design
    const boatsCount = Math.ceil(playerCount * 0.66);
    const swansCount = playerCount - boatsCount;

    // Duration: use custom or scale 45s (2p) → 60s (6-8p) → 75s (12p)
    const duration = customDuration || Math.round(45 + ((playerCount - 2) / 10) * 30);

    // Map size
    const width = 1600;
    const height = 900;

    // Safe zone: 180px (2p) → 150px (12p) - smaller for more players
    const safeZoneRadius = Math.round(180 - ((playerCount - 2) / 10) * 30);

    // Generate obstacles with proper IDs
    const obstacles: Obstacle[] = [];
    const obstacleCount = Math.min(3 + Math.floor(playerCount / 3), 8);
    
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

    return {
      totalPlayers: playerCount,
      boatsCount,
      swansCount,
      duration,
      gameArea: {
        width,
        height,
      },
      safeZone: {
        position: { x: width - 200, y: height / 2 }, // Right side
        radius: safeZoneRadius,
      },
      speeds: {
        boat: 5.0, // pixels per frame at 30 FPS = 150 px/sec
        boatSprint: 7.5, // 225 px/sec
        swan: 5.5, // 165 px/sec
        swanDash: 9.0, // 270 px/sec
      },
      tagRange: 40, // Distance for tagging
      obstacles,
    };
  }

  /**
   * Assign players to teams based on mode and player count
   */
  private assignTeams(playerIds: string[], mode: SwanChaseMode): Map<string, SwanChaseTeam> {
    const teams = new Map<string, SwanChaseTeam>();
    const playerCount = playerIds.length;

    if (mode === SwanChaseMode.CLASSIC || mode === SwanChaseMode.TEAM_ESCAPE || mode === SwanChaseMode.ROUNDS) {
      // ~66% boats, ~33% swans
      const boatCount = Math.ceil(playerCount * 0.66);

      // Shuffle for fair random assignment
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

      shuffled.forEach((id, index) => {
        teams.set(id, index < boatCount ? SwanChaseTeam.BLUE : SwanChaseTeam.WHITE);
      });
    } else if (mode === SwanChaseMode.KING_OF_LAKE) {
      // All vs one - first player is boat, rest are swans
      playerIds.forEach((id, index) => {
        teams.set(id, index === 0 ? SwanChaseTeam.BLUE : SwanChaseTeam.WHITE);
      });
    } else if (mode === SwanChaseMode.SWAN_SWARM) {
      // All vs time - everyone is a boat
      playerIds.forEach((id) => {
        teams.set(id, SwanChaseTeam.BLUE);
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
    isBoat: boolean, 
    teams: Map<string, SwanChaseTeam>,
    settings: SwanChaseSettings
  ): Vector2D {
    const { width, height } = settings.gameArea;

    if (isBoat) {
      // Boats start on left side, spread vertically
      const boatPlayers = Array.from(teams.values()).filter(t => t === SwanChaseTeam.BLUE).length;
      const boatIndex = Array.from(teams.entries())
        .filter(([_, team]) => team === SwanChaseTeam.BLUE)
        .length;
      
      return {
        x: 150 + Math.random() * 50, // 150-200px from left
        y: (height / (boatPlayers + 1)) * (boatIndex + 1) + (Math.random() - 0.5) * 50,
      };
    } else {
      // Swans start in center, clustered
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
          this.endGame(SwanChaseTeam.BLUE, 'TIME_SURVIVED'); // Boats win by timeout
        }
      }, this.PHYSICS_DELTA);
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

    // Ignore input from tagged/safe players
    if (player.status === SwanChasePlayerStatus.TAGGED || 
        player.status === SwanChasePlayerStatus.SAFE) {
      return;
    }

    const physics = this.playerPhysics.get(playerId)!;
    const isBoat = player.team === SwanChaseTeam.BLUE;
    const now = Date.now();

    // Update velocity based on direction
    const magnitude = Math.sqrt(input.direction.x ** 2 + input.direction.y ** 2);
    if (magnitude > 0) {
      const normalized = {
        x: input.direction.x / magnitude,
        y: input.direction.y / magnitude,
      };

      // Calculate rotation (angle in radians)
      player.rotation = Math.atan2(normalized.y, normalized.x);

      // Determine speed based on abilities
      let speed = isBoat 
        ? this.gameState.settings.speeds.boat 
        : this.gameState.settings.speeds.swan;

      // Handle dash (swans only)
      if (input.dash && !isBoat && player.abilities.dash) {
        if (now >= player.abilities.dash.cooldownUntil && player.abilities.dash.charges > 0) {
          player.abilities.dash.active = true;
          player.abilities.dash.charges--;
          player.abilities.dash.cooldownUntil = now + 4000; // 4s cooldown
          player.status = SwanChasePlayerStatus.DASHING;
          speed = this.gameState.settings.speeds.swanDash;
          
          // Dash lasts 1 second
          setTimeout(() => {
            if (player.abilities.dash) {
              player.abilities.dash.active = false;
            }
            if (player.status === SwanChasePlayerStatus.DASHING) {
              player.status = SwanChasePlayerStatus.HUNTING;
            }
          }, 1000);
        }
      }

      // Handle sprint (boats only)
      if (input.sprint && isBoat) {
        if (now >= player.abilities.sprint.cooldownUntil && player.abilities.sprint.charges > 0) {
          player.abilities.sprint.active = true;
          player.abilities.sprint.charges--;
          player.abilities.sprint.cooldownUntil = now + 3000; // 3s cooldown
          speed = this.gameState.settings.speeds.boatSprint;
          
          // Sprint lasts 2 seconds
          setTimeout(() => {
            player.abilities.sprint.active = false;
          }, 2000);
        } else if (player.abilities.sprint.active) {
          // Still sprinting
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
      // No movement input
      player.velocity = { x: 0, y: 0 };
      physics.speed = 0;
      physics.isMoving = false;
    }
  }

  /**
   * Update physics for one frame
   */
  private updatePhysics(): void {
    const { settings, players } = this.gameState;

    // Update timer
    const elapsed = Date.now() - this.gameState.startTime;
    this.gameState.timeRemaining = Math.max(0, settings.duration - Math.floor(elapsed / 1000));

    players.forEach((player) => {
      if (player.status === SwanChasePlayerStatus.TAGGED || 
          player.status === SwanChasePlayerStatus.SAFE) {
        return; // Skip inactive players
      }

      // Update position
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;

      // Clamp to map bounds
      player.position.x = Math.max(50, Math.min(settings.gameArea.width - 50, player.position.x));
      player.position.y = Math.max(50, Math.min(settings.gameArea.height - 50, player.position.y));

      // Check safe zone entry (boats only)
      if (player.team === SwanChaseTeam.BLUE && player.status === SwanChasePlayerStatus.ACTIVE) {
        const distToSafe = this.distance(player.position, settings.safeZone.position);
        if (distToSafe < settings.safeZone.radius) {
          player.status = SwanChasePlayerStatus.SAFE;
          player.velocity = { x: 0, y: 0 };
          player.score += 100; // Bonus for reaching safe zone
        }
      }

      // Check collisions with obstacles
      settings.obstacles.forEach((obstacle) => {
        const dist = this.distance(player.position, obstacle.position);
        if (dist < obstacle.radius + 20) { // 20px = player radius
          // Simple bounce back
          const angle = Math.atan2(
            player.position.y - obstacle.position.y,
            player.position.x - obstacle.position.x
          );
          player.position.x = obstacle.position.x + Math.cos(angle) * (obstacle.radius + 20);
          player.position.y = obstacle.position.y + Math.sin(angle) * (obstacle.radius + 20);
        }
      });
    });

    // Check tagging collisions
    this.checkTagging();
  }

  /**
   * Check for tagging collisions between swans and boats
   */
  private checkTagging(): void {
    const { players, settings } = this.gameState;
    const boats = players.filter(p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.ACTIVE);
    const swans = players.filter(p => p.team === SwanChaseTeam.WHITE && 
      (p.status === SwanChasePlayerStatus.HUNTING || p.status === SwanChasePlayerStatus.DASHING));

    boats.forEach((boat) => {
      swans.forEach((swan) => {
        const dist = this.distance(boat.position, swan.position);
        if (dist < settings.tagRange) {
          // Tag successful!
          boat.status = SwanChasePlayerStatus.TAGGED;
          boat.velocity = { x: 0, y: 0 };
          
          // Update scores
          swan.tagsCount = (swan.tagsCount || 0) + 1;
          swan.score += 50; // Points per tag
        }
      });
    });
  }

  /**
   * Check win conditions
   */
  private checkWinConditions(): void {
    if (this.gameState.status !== 'ACTIVE' || this.gameState.winConditionMet) return;

    const boats = this.gameState.players.filter(p => p.team === SwanChaseTeam.BLUE);
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
   * End the game
   */
  private endGame(winner: SwanChaseTeam, reason: string): void {
    this.gameState.status = 'ENDED';
    this.gameState.winner = winner;
    this.gameState.winConditionMet = true;
    this.stop();

    console.log(`[SwanChase] Game ended: ${winner} wins (${reason})`);
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
