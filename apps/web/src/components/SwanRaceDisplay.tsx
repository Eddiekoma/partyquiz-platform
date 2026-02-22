"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface SwanRaceDisplayProps {
  sessionCode: string;
  socket: Socket | null;
}

interface Swan {
  id: string;
  name: string;
  x: number;
  y: number;
  velocity: number;
  color: string;
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788",
];

const TRACK_LENGTH = 1200;
const SWAN_SIZE = 50;
const FINISH_LINE = TRACK_LENGTH - 80;

/**
 * SwanRaceDisplay - Display/spectator view of Swan Race
 * Shows the race canvas without any player controls.
 * Designed for big screen / projector display.
 */
export function SwanRaceDisplay({ sessionCode, socket }: SwanRaceDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [swans, setSwans] = useState<Swan[]>([]);
  const [raceFinished, setRaceFinished] = useState(false);
  const [finalPositions, setFinalPositions] = useState<string[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const waveOffset = useRef(0);

  useEffect(() => {
    if (!socket || !socket.connected) return;

    // Listen for game state updates (race positions)
    const handleGameState = (data: any) => {
      if (data.players) {
        const updatedSwans: Swan[] = data.players.map((p: any, idx: number) => ({
          id: p.id,
          name: p.name,
          x: p.position?.x || 0,
          y: 80 + idx * 80,
          velocity: p.velocity || 0,
          color: COLORS[idx % COLORS.length],
        }));
        setSwans(updatedSwans);

        if (data.raceFinished) {
          setRaceFinished(true);
          if (data.finalPositions) {
            setFinalPositions(data.finalPositions);
          }
        }
      }
    };

    socket.on("GAME_STATE", handleGameState);

    return () => {
      socket.off("GAME_STATE", handleGameState);
    };
  }, [socket]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Draw water background with gradient
      const waterGradient = ctx.createLinearGradient(0, 0, 0, height);
      waterGradient.addColorStop(0, "#1565C0");
      waterGradient.addColorStop(0.5, "#1976D2");
      waterGradient.addColorStop(1, "#1E88E5");
      ctx.fillStyle = waterGradient;
      ctx.fillRect(0, 0, width, height);

      // Animated waves
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#64B5F6";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        for (let x = 0; x < width; x += 8) {
          const y = Math.sin((x + waveOffset.current * 80 + i * 70) * 0.008) * 8 + 60 + i * (height / 8);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Draw lanes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([15, 10]);
      for (let i = 1; i <= swans.length; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 80);
        ctx.lineTo(width, i * 80);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw start line
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(30, 0, 3, height);

      // Draw finish line (checkered pattern)
      const finishX = FINISH_LINE;
      const squareSize = 20;
      for (let row = 0; row < Math.ceil(height / squareSize); row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? "#FFFFFF" : "#000000";
          ctx.fillRect(finishX + col * squareSize, row * squareSize, squareSize, squareSize);
        }
      }

      // Draw "FINISH" text
      ctx.save();
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.fillText("🏁 FINISH", finishX + 30, 30);
      ctx.restore();

      // Draw swans
      swans.forEach((swan, idx) => {
        const positionInRace = finalPositions.indexOf(swan.id);
        const hasFinished = positionInRace >= 0;

        // Wake trail
        if (swan.velocity > 0) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          for (let i = 1; i <= 5; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.4 / i})`;
            ctx.beginPath();
            ctx.arc(swan.x - i * 12, swan.y, 6 - i, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Swan body circle
        ctx.save();
        if (hasFinished) {
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 15;
        }
        ctx.fillStyle = swan.color;
        ctx.beginPath();
        ctx.arc(swan.x + SWAN_SIZE / 2, swan.y, SWAN_SIZE / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Swan emoji
        ctx.font = `${SWAN_SIZE - 5}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🦢", swan.x + SWAN_SIZE / 2, swan.y);

        // Name tag with background
        const name = swan.name.length > 12 ? swan.name.slice(0, 12) + "…" : swan.name;
        ctx.font = "bold 16px Arial";
        const nameWidth = ctx.measureText(name).width;
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.roundRect(swan.x + SWAN_SIZE / 2 - nameWidth / 2 - 8, swan.y - 45, nameWidth + 16, 24, 6);
        ctx.fill();

        ctx.fillStyle = swan.color;
        ctx.textAlign = "center";
        ctx.fillText(name, swan.x + SWAN_SIZE / 2, swan.y - 30);

        // Position badge if finished
        if (hasFinished) {
          const medals = ["🥇", "🥈", "🥉"];
          const badge = positionInRace < 3 ? medals[positionInRace] : `#${positionInRace + 1}`;
          ctx.font = "bold 28px Arial";
          ctx.textAlign = "center";
          ctx.fillText(badge, swan.x + SWAN_SIZE / 2, swan.y + 40);
        }

        // Velocity bar
        if (swan.velocity > 0 && !hasFinished) {
          const barWidth = 50;
          const barHeight = 6;
          const barX = swan.x + SWAN_SIZE / 2 - barWidth / 2;
          const barY = swan.y + 35;
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(barX, barY, barWidth, barHeight);
          
          ctx.fillStyle = swan.color;
          ctx.fillRect(barX, barY, Math.min(barWidth, (swan.velocity / 10) * barWidth), barHeight);
        }
      });

      // Title
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(width / 2 - 150, 5, 300, 45);
      ctx.fillStyle = "white";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🦢 Swan Race 🦢", width / 2, 35);
      ctx.restore();

      // Race finished overlay
      if (raceFinished && finalPositions.length > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(width / 2 - 200, height - 80, 400, 60);
        
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 32px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText("🏆 Race Complete! 🏆", width / 2, height - 42);
        ctx.restore();
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
  }, [swans, raceFinished, finalPositions]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <canvas
        ref={canvasRef}
        width={TRACK_LENGTH + 200}
        height={Math.max(swans.length * 80 + 80, 500)}
        className="border-4 border-blue-700 rounded-2xl shadow-2xl"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
