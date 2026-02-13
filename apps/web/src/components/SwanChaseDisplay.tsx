"use client";

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  WSMessageType, 
  SwanChaseGameState, 
  SwanChasePlayer,
  SwanChasePlayerStatus,
  SwanChaseTeam,
  Vector2D,
} from "@partyquiz/shared";

interface SwanChaseDisplayProps {
  sessionCode: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export function SwanChaseDisplay({ sessionCode }: SwanChaseDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<SwanChaseGameState | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const { socket, isConnected } = useWebSocket();

  // Water animation parameters
  const waveOffset = useRef(0);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for game state updates
    socket.on(WSMessageType.SWAN_CHASE_STATE, (state: SwanChaseGameState) => {
      setGameState(state);
    });

    socket.on(WSMessageType.BOAT_TAGGED, (data: { playerId: string; position: Vector2D }) => {
      // Create explosion particles
      createExplosion(data.position.x, data.position.y, "#FF4444");
    });

    socket.on(WSMessageType.BOAT_SAFE, (data: { playerId: string; position: Vector2D }) => {
      // Create sparkle particles
      createSparkles(data.position.x, data.position.y, "#FFD700");
    });

    return () => {
      socket.off(WSMessageType.SWAN_CHASE_STATE);
      socket.off(WSMessageType.BOAT_TAGGED);
      socket.off(WSMessageType.BOAT_SAFE);
    };
  }, [socket, isConnected]);

  // Create explosion particles
  const createExplosion = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 3 + Math.random() * 2;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color,
        size: 3 + Math.random() * 3,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Create sparkle particles
  const createSparkles = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 2,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw water background with animated waves
      drawWater(ctx, canvas.width, canvas.height);

      // Draw obstacles
      gameState.settings.obstacles.forEach(obstacle => {
        drawObstacle(ctx, obstacle);
      });

      // Draw safe zone
      drawSafeZone(ctx, gameState.settings.safeZone, gameState.timeRemaining);

      // Draw players (boats and swans)
      gameState.players.forEach(player => {
        if (player.team === SwanChaseTeam.BLUE) {
          drawBoat(ctx, player);
        } else {
          drawSwan(ctx, player);
        }
        drawPlayerLabel(ctx, player);
      });

      // Update and draw particles
      updateAndDrawParticles(ctx);

      // Draw HUD
      drawHUD(ctx, canvas.width, canvas.height, gameState);

      // Draw game status overlay
      if (gameState.status === 'COUNTDOWN') {
        drawCountdown(ctx, canvas.width, canvas.height);
      } else if (gameState.status === 'ENDED') {
        drawEndOverlay(ctx, canvas.width, canvas.height, gameState);
      }

      waveOffset.current += 0.02;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, particles]);

  // Draw animated water background
  const drawWater = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Base water color
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1e3a8a");
    gradient.addColorStop(1, "#0c4a6e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw animated waves
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;

    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let x = 0; x < width; x += 10) {
        const y = Math.sin((x + waveOffset.current * 100 + i * 50) * 0.01) * 10 + height / 2 + i * 40;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw obstacle (island or rock)
  const drawObstacle = (ctx: CanvasRenderingContext2D, obstacle: any) => {
    ctx.save();
    if (obstacle.type === 'ISLAND') {
      // Draw island with palm tree
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(obstacle.position.x, obstacle.position.y, obstacle.radius, 0, Math.PI * 2);
      ctx.fill();

      // Palm tree trunk
      ctx.fillStyle = "#92400e";
      ctx.fillRect(
        obstacle.position.x - 3,
        obstacle.position.y - obstacle.radius,
        6,
        obstacle.radius * 0.8
      );

      // Palm leaves
      ctx.fillStyle = "#16a34a";
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.ellipse(
          obstacle.position.x + Math.cos(angle) * 15,
          obstacle.position.y - obstacle.radius,
          8,
          15,
          angle,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    } else {
      // Draw rock
      ctx.fillStyle = "#64748b";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Irregular rock shape
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const radius = obstacle.radius * (0.8 + Math.random() * 0.4);
        const x = obstacle.position.x + Math.cos(angle) * radius;
        const y = obstacle.position.y + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw safe zone with pulsing effect
  const drawSafeZone = (ctx: CanvasRenderingContext2D, safeZone: any, timeRemaining: number) => {
    ctx.save();
    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;

    // Outer glow
    const gradient = ctx.createRadialGradient(
      safeZone.position.x,
      safeZone.position.y,
      0,
      safeZone.position.x,
      safeZone.position.y,
      safeZone.radius
    );
    gradient.addColorStop(0, `rgba(34, 197, 94, ${0.3 * pulse})`);
    gradient.addColorStop(0.7, `rgba(34, 197, 94, ${0.2 * pulse})`);
    gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(safeZone.position.x, safeZone.position.y, safeZone.radius, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // "SAFE ZONE" text
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SAFE ZONE", safeZone.position.x, safeZone.position.y);

    ctx.restore();
  };

  // Draw boat player
  const drawBoat = (ctx: CanvasRenderingContext2D, player: SwanChasePlayer) => {
    ctx.save();
    ctx.translate(player.position.x, player.position.y);
    ctx.rotate(player.rotation);

    // Status effects
    if (player.status === SwanChasePlayerStatus.TAGGED) {
      ctx.globalAlpha = 0.4;
      ctx.filter = "grayscale(1)";
    } else if (player.status === SwanChasePlayerStatus.SAFE) {
      ctx.filter = "drop-shadow(0 0 10px #22c55e)";
    }

    // Sprint effect
    if (player.abilities.sprint.active) {
      ctx.filter = "drop-shadow(0 0 15px #3b82f6)";
    }

    // Boat body
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, -10);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-15, 10);
    ctx.closePath();
    ctx.fill();

    // Boat outline
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player icon/emoji in boat
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚣", 0, 0);

    ctx.restore();

    // Draw wake trail if moving
    if (player.velocity.x !== 0 || player.velocity.y !== 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      const trailX = player.position.x - Math.cos(player.rotation) * 25;
      const trailY = player.position.y - Math.sin(player.rotation) * 25;
      ctx.beginPath();
      ctx.moveTo(player.position.x, player.position.y);
      ctx.lineTo(trailX, trailY);
      ctx.stroke();
      ctx.restore();
    }
  };

  // Draw swan player
  const drawSwan = (ctx: CanvasRenderingContext2D, player: SwanChasePlayer) => {
    ctx.save();
    ctx.translate(player.position.x, player.position.y);
    ctx.rotate(player.rotation);

    // Dash effect
    if (player.status === SwanChasePlayerStatus.DASHING) {
      ctx.filter = "drop-shadow(0 0 20px #ef4444)";
      
      // Dash trail
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.3 / i;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.ellipse(-i * 15, 0, 18, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Swan body (white with elegant curves)
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swan neck
    ctx.strokeStyle = "white";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(15, -5);
    ctx.quadraticCurveTo(25, -15, 28, -8);
    ctx.stroke();

    // Swan head
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(28, -8, 5, 0, Math.PI * 2);
    ctx.fill();

    // Swan beak
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(33, -8);
    ctx.lineTo(28, -10);
    ctx.lineTo(28, -6);
    ctx.closePath();
    ctx.fill();

    // Swan eye
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(30, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Swan wings (when dashing)
    if (player.status === SwanChasePlayerStatus.DASHING) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.ellipse(0, -12, 15, 8, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 12, 15, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Draw player name label
  const drawPlayerLabel = (ctx: CanvasRenderingContext2D, player: SwanChasePlayer) => {
    ctx.save();
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Background
    const text = player.name;
    const metrics = ctx.measureText(text);
    const padding = 4;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 16;

    ctx.fillStyle = player.team === SwanChaseTeam.BLUE ? "rgba(59, 130, 246, 0.9)" : "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(
      player.position.x - bgWidth / 2,
      player.position.y - 40,
      bgWidth,
      bgHeight
    );

    // Text
    ctx.fillStyle = player.team === SwanChaseTeam.BLUE ? "white" : "black";
    ctx.fillText(text, player.position.x, player.position.y - 38);

    // Status badge
    if (player.status === SwanChasePlayerStatus.TAGGED) {
      ctx.fillStyle = "red";
      ctx.font = "10px Arial";
      ctx.fillText("TAGGED", player.position.x, player.position.y - 55);
    } else if (player.status === SwanChasePlayerStatus.SAFE) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "10px Arial";
      ctx.fillText("SAFE!", player.position.x, player.position.y - 55);
    }

    ctx.restore();
  };

  // Update and draw particles
  const updateAndDrawParticles = (ctx: CanvasRenderingContext2D) => {
    setParticles(prev => {
      const updated = prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.1, // Gravity
          life: p.life - 0.02,
        }))
        .filter(p => p.life > 0);

      // Draw
      updated.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      return updated;
    });
  };

  // Draw HUD (timer, score, team stats)
  const drawHUD = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SwanChaseGameState
  ) => {
    ctx.save();

    // Timer (top center)
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(width / 2 - 100, 10, 200, 50);
    ctx.fillStyle = state.timeRemaining <= 10 ? "#ef4444" : "white";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `${Math.floor(state.timeRemaining / 60)}:${(state.timeRemaining % 60).toString().padStart(2, '0')}`,
      width / 2,
      45
    );

    // Team scores (top corners)
    const boatsAlive = state.players.filter(
      p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.ACTIVE
    ).length;
    const boatsSafe = state.players.filter(
      p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.SAFE
    ).length;
    const boatsTagged = state.players.filter(
      p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.TAGGED
    ).length;

    const swanTags = state.players
      .filter(p => p.team === SwanChaseTeam.WHITE)
      .reduce((sum, p) => sum + (p.tagsCount || 0), 0);

    // Boats team (left)
    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.fillRect(10, 10, 200, 80);
    ctx.fillStyle = "white";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText("🚣 BOATS TEAM", 20, 35);
    ctx.font = "14px Arial";
    ctx.fillText(`Active: ${boatsAlive}`, 20, 55);
    ctx.fillText(`Safe: ${boatsSafe}`, 20, 73);
    ctx.fillText(`Tagged: ${boatsTagged}`, 120, 73);

    // Swans team (right)
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(width - 210, 10, 200, 80);
    ctx.fillStyle = "black";
    ctx.textAlign = "right";
    ctx.fillText("🦢 SWANS TEAM", width - 20, 35);
    ctx.font = "14px Arial";
    ctx.fillText(`Hunters: ${state.settings.swansCount}`, width - 20, 55);
    ctx.fillText(`Tags: ${swanTags}`, width - 20, 73);

    ctx.restore();
  };

  // Draw countdown
  const drawCountdown = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const elapsed = Date.now() - gameState!.startTime;
    const countdown = Math.max(0, 3 - Math.floor(elapsed / 1000));

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "white";
    ctx.font = "bold 120px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countdown > 0 ? countdown.toString() : "GO!", width / 2, height / 2);

    ctx.restore();
  };

  // Draw end game overlay
  const drawEndOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SwanChaseGameState
  ) => {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, width, height);

    // Winner announcement
    const winnerTeam = state.winner === SwanChaseTeam.BLUE ? "BOATS" : "SWANS";
    const winnerEmoji = state.winner === SwanChaseTeam.BLUE ? "🚣" : "🦢";
    const winnerColor = state.winner === SwanChaseTeam.BLUE ? "#3b82f6" : "#ffffff";

    ctx.fillStyle = winnerColor;
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${winnerEmoji} ${winnerTeam} WIN! ${winnerEmoji}`, width / 2, height / 2 - 50);

    // Stats
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    const boatsSaved = state.players.filter(
      p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.SAFE
    ).length;
    const boatsTagged = state.players.filter(
      p => p.team === SwanChaseTeam.BLUE && p.status === SwanChasePlayerStatus.TAGGED
    ).length;

    ctx.fillText(`Boats Saved: ${boatsSaved}`, width / 2, height / 2 + 50);
    ctx.fillText(`Boats Tagged: ${boatsTagged}`, width / 2, height / 2 + 85);

    ctx.restore();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900">
      <canvas
        ref={canvasRef}
        width={1600}
        height={900}
        className="border-4 border-slate-700 rounded-lg shadow-2xl"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
