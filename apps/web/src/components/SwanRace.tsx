"use client";

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";

interface SwanRaceProps {
  sessionCode: string;
  playerId: string;
  playerName: string;
  isActive: boolean;
  onFinish?: (position: number) => void;
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
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
];

const TRACK_LENGTH = 800;
const SWAN_WIDTH = 40;
const SWAN_HEIGHT = 40;
const FINISH_LINE = TRACK_LENGTH - 50;

export function SwanRace({ sessionCode, playerId, playerName, isActive, onFinish }: SwanRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [swans, setSwans] = useState<Swan[]>([]);
  const [finished, setFinished] = useState(false);
  const [finalPosition, setFinalPosition] = useState<number | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const inputStartTime = useRef<number>(0);
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for game state updates
    socket.on("GAME_STATE", (data: any) => {
      if (data.players) {
        const updatedSwans: Swan[] = data.players.map((p: any, idx: number) => ({
          id: p.id,
          name: p.name,
          x: p.position?.x || 0,
          y: 50 + idx * 60, // Lane positioning
          velocity: p.velocity || 0,
          color: COLORS[idx % COLORS.length],
        }));
        setSwans(updatedSwans);

        // Check if race is finished
        if (data.raceFinished && !finished) {
          const myPosition = data.finalPositions?.findIndex((id: string) => id === playerId) + 1;
          if (myPosition) {
            setFinished(true);
            setFinalPosition(myPosition);
            onFinish?.(myPosition);
          }
        }
      }
    });

    return () => {
      socket.off("GAME_STATE");
    };
  }, [socket, isConnected, playerId, finished, onFinish]);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Animation loop
    const animate = () => {
      // Clear canvas
      ctx.fillStyle = "#E3F2FD";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw water texture
      ctx.fillStyle = "#90CAF9";
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.fillRect(0, i, canvas.width, 10);
      }

      // Draw lanes
      ctx.strokeStyle = "#2196F3";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      for (let i = 1; i < swans.length; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 60);
        ctx.lineTo(canvas.width, i * 60);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw finish line
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(FINISH_LINE, 0, 5, canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = "bold 16px Arial";
      ctx.fillText("🏁", FINISH_LINE - 15, 20);

      // Draw swans
      swans.forEach((swan) => {
        // Swan body (emoji or circle)
        ctx.fillStyle = swan.color;
        ctx.beginPath();
        ctx.arc(swan.x + SWAN_WIDTH / 2, swan.y, SWAN_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();

        // Swan emoji
        ctx.font = "30px Arial";
        ctx.fillText("🦢", swan.x, swan.y + 10);

        // Name tag
        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.fillText(swan.name, swan.x - 20, swan.y - 30);

        // Velocity indicator (waves)
        if (swan.velocity > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${swan.velocity / 10})`;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(swan.x - i * 10, swan.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [swans, isActive]);

  const handleInput = (active: boolean) => {
    if (!socket || !isConnected || !isActive || finished) return;

    setInputActive(active);

    if (active) {
      inputStartTime.current = Date.now();
    } else {
      const duration = Date.now() - inputStartTime.current;
      
      // Send input to server
      socket.emit("GAME_INPUT", {
        sessionCode,
        playerId,
        input: {
          action: "STROKE",
          duration,
          timestamp: Date.now(),
        },
      });
    }
  };

  if (!isActive) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Waiting for Swan Race to start...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="border-4 border-blue-500 rounded-lg overflow-hidden bg-blue-50">
        <canvas
          ref={canvasRef}
          width={TRACK_LENGTH + 100}
          height={Math.max(swans.length * 60, 360)}
          className="w-full"
        />
      </div>

      {/* Controls */}
      {!finished && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white">Tap and Hold to Paddle!</p>
            <p className="text-sm text-slate-400">The longer you hold, the stronger your stroke</p>
          </div>
          <button
            onMouseDown={() => handleInput(true)}
            onMouseUp={() => handleInput(false)}
            onTouchStart={() => handleInput(true)}
            onTouchEnd={() => handleInput(false)}
            className={`w-full max-w-md py-12 text-2xl font-black rounded-2xl transition-all transform ${
              inputActive
                ? "bg-blue-700 text-white scale-95 shadow-inner"
                : "bg-blue-500 text-white scale-100 shadow-lg hover:bg-blue-600 active:scale-95"
            }`}
          >
            {inputActive ? "🌊 PADDLING! 🌊" : "🦢 TAP TO PADDLE 🦢"}
          </button>
        </div>
      )}

      {/* Finish */}
      {finished && finalPosition && (
        <div className="text-center p-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
          <p className="text-4xl font-black mb-2">
            {finalPosition === 1 && "🥇 1st Place!"}
            {finalPosition === 2 && "🥈 2nd Place!"}
            {finalPosition === 3 && "🥉 3rd Place!"}
            {finalPosition > 3 && `Position ${finalPosition}`}
          </p>
          <p className="text-lg text-slate-300">Great paddling, {playerName}!</p>
        </div>
      )}
    </div>
  );
}
