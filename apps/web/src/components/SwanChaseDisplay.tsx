"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  WSMessageType,
  SwanChaseGameState,
  SwanChasePlayerStatus,
  SwanChaseTeam,
  type Vector2D,
} from "@partyquiz/shared";
import { ParticleSystem } from "@/lib/swan-chase/particles";
import {
  drawWater,
  drawBoatSprite,
  drawSwanSprite,
  drawAISwanSprite,
  drawObstacles,
  drawSafeZone,
  drawRaceLanes,
  drawPlayerLabel,
  drawHUD,
  drawMiniMap,
  drawCountdown,
  drawEndScreen,
  applyScreenShake,
  createShake,
  type ScreenShake,
} from "@/lib/swan-chase/rendering";

// Adaptive quality levels based on FPS
type QualityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface QualitySettings {
  level: QualityLevel;
  waveAnimations: boolean;       // Disable at LOW
  waveLayers: number;            // 4 at HIGH, 2 at MEDIUM, 0 at LOW
  ambientParticles: boolean;     // Disable at MEDIUM/LOW
  trailParticles: boolean;       // Disable at LOW
  confettiRate: number;          // 0.3 at HIGH, 0.1 at MEDIUM, 0 at LOW
  foamHighlights: boolean;       // Disable at LOW
}

const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  HIGH:   { level: 'HIGH',   waveAnimations: true,  waveLayers: 4, ambientParticles: true,  trailParticles: true,  confettiRate: 0.3,  foamHighlights: true  },
  MEDIUM: { level: 'MEDIUM', waveAnimations: true,  waveLayers: 2, ambientParticles: false, trailParticles: true,  confettiRate: 0.1,  foamHighlights: false },
  LOW:    { level: 'LOW',    waveAnimations: false, waveLayers: 0, ambientParticles: false, trailParticles: false, confettiRate: 0,    foamHighlights: false },
};

interface SwanChaseDisplayProps {
  sessionCode: string;
  socket: Socket | null;
}

export function SwanChaseDisplay({ sessionCode, socket }: SwanChaseDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<SwanChaseGameState | null>(null);
  const gameStateRef = useRef<SwanChaseGameState | null>(null);
  const particlesRef = useRef<ParticleSystem>(new ParticleSystem(200));
  const animationFrameRef = useRef<number | undefined>(undefined);
  const shakeRef = useRef<ScreenShake | null>(null);
  const lastFrameTimeRef = useRef(0);
  const prevPlayerStatusRef = useRef<Map<string, string>>(new Map());

  // Performance monitoring & adaptive quality
  const fpsRef = useRef({ frameCount: 0, lastCheck: 0, fps: 60 });
  const qualityRef = useRef<QualitySettings>(QUALITY_PRESETS.HIGH);
  const lowFpsCountRef = useRef(0); // consecutive low-FPS checks before downgrading
  const highFpsCountRef = useRef(0); // consecutive high-FPS checks before upgrading

  useEffect(() => {
    if (!socket || !socket.connected) return;

    socket.on(WSMessageType.SWAN_CHASE_STATE, (state: SwanChaseGameState) => {
      const prevState = gameStateRef.current;
      gameStateRef.current = state;
      setGameState(state);

      // Detect status changes for particle effects and screen shake
      if (prevState) {
        const prevStatuses = prevPlayerStatusRef.current;

        for (const player of state.players) {
          const prevStatus = prevStatuses.get(player.id);

          if (prevStatus && prevStatus !== player.status) {
            // Player was tagged
            if (player.status === SwanChasePlayerStatus.TAGGED) {
              particlesRef.current.emit('SPLASH', player.position.x, player.position.y, 15, {
                colors: ['#ef4444', '#dc2626', '#fca5a5'],
                minSpeed: 2,
                maxSpeed: 5,
              });
              shakeRef.current = createShake(8, 300);
            }

            // Player eliminated (stronger shake)
            if (player.status === SwanChasePlayerStatus.ELIMINATED) {
              particlesRef.current.emit('SPLASH', player.position.x, player.position.y, 20, {
                colors: ['#ef4444', '#dc2626', '#7f1d1d', '#fca5a5'],
                minSpeed: 3,
                maxSpeed: 6,
              });
              shakeRef.current = createShake(12, 500);
            }

            // Player reached safe zone
            if (player.status === SwanChasePlayerStatus.SAFE) {
              particlesRef.current.emit('SPARKLE', player.position.x, player.position.y, 20, {
                colors: ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff'],
                minSpeed: 1,
                maxSpeed: 3,
                gravity: -20,
              });
            }

            // Crown stolen
            if (player.status === SwanChasePlayerStatus.KING) {
              particlesRef.current.emit('SPARKLE', player.position.x, player.position.y, 25, {
                colors: ['#fbbf24', '#f59e0b', '#fde68a'],
                minSpeed: 2,
                maxSpeed: 4,
              });
              shakeRef.current = createShake(6, 400);
            }
          }
        }

        // Update previous statuses
        const newStatuses = new Map<string, string>();
        for (const p of state.players) {
          newStatuses.set(p.id, p.status);
        }
        prevPlayerStatusRef.current = newStatuses;
      }
    });

    socket.emit("GET_SESSION_STATE", { sessionCode });

    return () => {
      socket.off(WSMessageType.SWAN_CHASE_STATE);
    };
  }, [socket, sessionCode]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (timestamp: number) => {
      const currentState = gameStateRef.current;
      if (!currentState) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time
      const dt = lastFrameTimeRef.current ? (timestamp - lastFrameTimeRef.current) / 1000 : 1 / 60;
      lastFrameTimeRef.current = timestamp;
      const time = timestamp / 1000;

      // FPS tracking + adaptive quality
      fpsRef.current.frameCount++;
      if (timestamp - fpsRef.current.lastCheck > 1000) {
        fpsRef.current.fps = fpsRef.current.frameCount;
        fpsRef.current.frameCount = 0;
        fpsRef.current.lastCheck = timestamp;

        const fps = fpsRef.current.fps;
        const currentLevel = qualityRef.current.level;

        // Downgrade: 3 consecutive seconds below threshold
        if (fps < 30 && currentLevel !== 'LOW') {
          lowFpsCountRef.current++;
          highFpsCountRef.current = 0;
          if (lowFpsCountRef.current >= 3) {
            qualityRef.current = QUALITY_PRESETS.LOW;
            lowFpsCountRef.current = 0;
          }
        } else if (fps < 50 && currentLevel === 'HIGH') {
          lowFpsCountRef.current++;
          highFpsCountRef.current = 0;
          if (lowFpsCountRef.current >= 3) {
            qualityRef.current = QUALITY_PRESETS.MEDIUM;
            lowFpsCountRef.current = 0;
          }
        }
        // Upgrade: 5 consecutive seconds above threshold (slower to recover)
        else if (fps >= 55 && currentLevel !== 'HIGH') {
          highFpsCountRef.current++;
          lowFpsCountRef.current = 0;
          if (highFpsCountRef.current >= 5) {
            qualityRef.current = currentLevel === 'LOW' ? QUALITY_PRESETS.MEDIUM : QUALITY_PRESETS.HIGH;
            highFpsCountRef.current = 0;
          }
        } else {
          // Stable - reset counters
          lowFpsCountRef.current = 0;
          highFpsCountRef.current = 0;
        }
      }

      const quality = qualityRef.current;

      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Apply screen shake
      ctx.save();
      applyScreenShake(ctx, shakeRef.current, Date.now());

      // === LAYER 1: Water background ===
      drawWater(ctx, width, height, time, quality.waveLayers, quality.foamHighlights);

      const isRaceMode = (currentState.mode as string) === 'RACE';

      // === LAYER 2: Obstacles / Race lanes ===
      if (isRaceMode) {
        drawRaceLanes(ctx, currentState, width, height, time);
      } else {
        drawObstacles(ctx, currentState.settings.obstacles, width, height, time);
      }

      // === LAYER 3: Safe zone (skip for RACE) ===
      if (!isRaceMode) {
        drawSafeZone(ctx, currentState.settings.safeZone, time);
      }

      // === LAYER 4: AI Swans (SWAN_SWARM) ===
      if (currentState.aiSwans) {
        for (const ai of currentState.aiSwans) {
          drawAISwanSprite(ctx, ai, time);
        }
      }

      // === LAYER 5: Players ===
      // Draw swans first (behind boats visually)
      const swans = currentState.players.filter(p => p.team === SwanChaseTeam.WHITE);
      const boats = currentState.players.filter(p => p.team !== SwanChaseTeam.WHITE);

      for (const player of swans) {
        drawSwanSprite(ctx, player, time);
      }

      for (const player of boats) {
        drawBoatSprite(ctx, player, time);
      }

      // Player labels (drawn after all sprites so labels are on top)
      for (const player of currentState.players) {
        drawPlayerLabel(ctx, player, currentState);
      }

      // === LAYER 6: Particles (adaptive) ===
      // Emit ambient water bubbles occasionally (skip at MEDIUM/LOW)
      if (quality.ambientParticles && Math.random() < 0.05) {
        particlesRef.current.emit('BUBBLE',
          Math.random() * width,
          height - 10,
          1,
          { minLife: 1, maxLife: 2, gravity: -40 }
        );
      }

      // Emit speed trails for sprinting/dashing players (skip at LOW)
      if (quality.trailParticles) {
        for (const player of currentState.players) {
          const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
          if (player.abilities.sprint.active && speed > 1) {
            particlesRef.current.emit('TRAIL', player.position.x, player.position.y, 1, {
              colors: ['#60a5fa', '#93c5fd'],
              minSize: 2,
              maxSize: 4,
              minLife: 0.2,
              maxLife: 0.4,
              minSpeed: 0.2,
              maxSpeed: 0.5,
              direction: Math.atan2(-player.velocity.y, -player.velocity.x),
              spread: 0.5,
            });
          }
          if (player.abilities.dash?.active && speed > 1) {
            particlesRef.current.emit('TRAIL', player.position.x, player.position.y, 2, {
              colors: ['#f97316', '#fb923c', '#fdba74'],
              minSize: 3,
              maxSize: 5,
              minLife: 0.2,
              maxLife: 0.5,
              minSpeed: 0.3,
              maxSpeed: 0.8,
              direction: Math.atan2(-player.velocity.y, -player.velocity.x),
              spread: 0.4,
            });
          }
        }
      }

      particlesRef.current.update(dt);
      particlesRef.current.draw(ctx);

      // === LAYER 7: HUD ===
      drawHUD(ctx, currentState, width, height, time);

      // === LAYER 8: Mini-map ===
      drawMiniMap(ctx, currentState, width, height);

      // === LAYER 9: Overlays ===
      if (currentState.status === 'COUNTDOWN') {
        drawCountdown(ctx, width, height, currentState, time);
      } else if (currentState.status === 'ENDED') {
        drawEndScreen(ctx, currentState, width, height, time);

        // Emit confetti for winners (adaptive rate)
        if (quality.confettiRate > 0 && Math.random() < quality.confettiRate) {
          particlesRef.current.emit('CONFETTI',
            Math.random() * width,
            -10,
            2,
            { minLife: 2, maxLife: 4, gravity: 80 }
          );
        }
      }

      // Restore from screen shake
      ctx.restore();

      // Debug FPS (enable with ?debug=1)
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
        const debugText = `${fpsRef.current.fps} FPS | ${particlesRef.current.activeCount}P | Q:${quality.level}`;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(4, height - 22, debugText.length * 7 + 8, 18);
        ctx.fillStyle = fpsRef.current.fps < 30 ? '#ef4444' : fpsRef.current.fps < 50 ? '#f59e0b' : '#22c55e';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(debugText, 8, height - 20);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!gameState]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900">
      {!gameState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-8xl mb-6 animate-bounce">🦢</div>
          <h2 className="text-4xl font-bold text-white mb-2">Swan Chase</h2>
          <p className="text-xl text-slate-400 animate-pulse">Loading game...</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={1600}
        height={900}
        className="border-2 border-slate-700/50 rounded-xl shadow-2xl"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
