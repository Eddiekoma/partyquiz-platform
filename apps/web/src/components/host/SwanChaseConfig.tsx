"use client";

import { useState, useEffect } from "react";
import { WSMessageType, SwanChaseGameState } from "@partyquiz/shared";

interface Player {
  id: string;
  name: string;
  avatar?: string | null;
  isOnline: boolean;
}

interface SwanChaseConfigProps {
  sessionCode: string;
  players: Player[];
  socket: any;
  isConnected: boolean;
  gameState: SwanChaseGameState | null;
}

interface TeamAssignment {
  playerId: string;
  team: "BLUE" | "WHITE" | "UNASSIGNED";
}

export function SwanChaseConfig({
  sessionCode,
  players,
  socket,
  isConnected,
  gameState,
}: SwanChaseConfigProps) {
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [duration, setDuration] = useState(180); // 3 minutes default
  const [mode, setMode] = useState<"CLASSIC" | "ROUNDS">("CLASSIC");
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize team assignments
  useEffect(() => {
    const assignments: TeamAssignment[] = players.map((player) => ({
      playerId: player.id,
      team: "UNASSIGNED",
    }));
    setTeamAssignments(assignments);
  }, [players]);

  // Listen for game state updates
  useEffect(() => {
    if (!socket) return;

    socket.on(WSMessageType.SWAN_CHASE_STARTED, () => {
      setIsConfiguring(false);
    });

    socket.on(WSMessageType.SWAN_CHASE_ENDED, () => {
      setIsConfiguring(true);
    });

    return () => {
      socket.off(WSMessageType.SWAN_CHASE_STARTED);
      socket.off(WSMessageType.SWAN_CHASE_ENDED);
    };
  }, [socket]);

  const assignTeam = (playerId: string, team: "BLUE" | "WHITE" | "UNASSIGNED") => {
    setTeamAssignments((prev) =>
      prev.map((assignment) =>
        assignment.playerId === playerId ? { ...assignment, team } : assignment
      )
    );
  };

  const autoAssignTeams = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const blueCount = Math.ceil(shuffled.length / 2);

    const newAssignments = shuffled.map((player, index) => ({
      playerId: player.id,
      team: (index < blueCount ? "BLUE" : "WHITE") as "BLUE" | "WHITE",
    }));

    setTeamAssignments(newAssignments);
  };

  const startGame = () => {
    const blueTeam = teamAssignments.filter((a) => a.team === "BLUE");
    const whiteTeam = teamAssignments.filter((a) => a.team === "WHITE");

    if (blueTeam.length === 0) {
      setError("Blue team needs at least 1 player!");
      return;
    }

    if (whiteTeam.length === 0) {
      setError("White team needs at least 1 player!");
      return;
    }

    if (!socket || !isConnected) {
      setError("Not connected to server!");
      return;
    }

    socket.emit(WSMessageType.START_SWAN_CHASE, {
      sessionCode,
      mode,
      duration,
      teamAssignments: teamAssignments.filter((a) => a.team !== "UNASSIGNED"),
    });

    setError(null);
  };

  const endGame = () => {
    if (!socket || !isConnected) return;

    socket.emit("END_SWAN_CHASE", {
      sessionCode,
    });
  };

  const blueCount = teamAssignments.filter((a) => a.team === "BLUE").length;
  const whiteCount = teamAssignments.filter((a) => a.team === "WHITE").length;
  const unassignedCount = teamAssignments.filter((a) => a.team === "UNASSIGNED").length;

  // Show monitoring dashboard if game is active
  if (gameState && !isConfiguring) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              🦢 Swan Chase - {gameState.status === "COUNTDOWN" ? "Starting..." : "Active"}
            </h3>
            <p className="text-sm text-slate-400">Round {gameState.round} of 2</p>
          </div>
          <button
            onClick={endGame}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            End Game
          </button>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Time Remaining</div>
            <div className="text-3xl font-bold text-white">
              {Math.ceil((gameState.timeRemaining || 0) / 1000)}s
            </div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
            <div className="text-sm text-blue-300 mb-1">Blue Team (Boats)</div>
            <div className="flex gap-4">
              <div>
                <div className="text-xs text-blue-200">Active</div>
                <div className="text-2xl font-bold text-blue-400">
                  {gameState.players.filter((p) => p.team === "BLUE" && p.status === "ACTIVE").length}
                </div>
              </div>
              <div>
                <div className="text-xs text-yellow-200">Safe</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {gameState.players.filter((p) => p.team === "BLUE" && p.status === "SAFE").length}
                </div>
              </div>
              <div>
                <div className="text-xs text-red-200">Tagged</div>
                <div className="text-2xl font-bold text-red-400">
                  {gameState.players.filter((p) => p.team === "BLUE" && p.status === "TAGGED").length}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-500/30">
            <div className="text-sm text-slate-300 mb-1">White Team (Swans)</div>
            <div>
              <div className="text-xs text-orange-200">Total Tags</div>
              <div className="text-2xl font-bold text-orange-400">
                {gameState.players
                  .filter((p) => p.team === "WHITE")
                  .reduce((sum, p) => sum + (p.tagsCount || 0), 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Live Player Status */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Live Player Status</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.team === "BLUE"
                    ? "bg-blue-900/20 border border-blue-500/30"
                    : "bg-slate-800/20 border border-slate-500/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.team === "BLUE" ? "🚤" : "🦢"}</span>
                  <div>
                    <div className="font-medium text-white">{player.name}</div>
                    <div className="text-xs text-slate-400">
                      {player.type} • {player.team}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {player.tagsCount !== undefined && player.tagsCount > 0 && (
                    <div className="text-sm font-bold text-orange-400">
                      {player.tagsCount} {player.tagsCount === 1 ? "tag" : "tags"}
                    </div>
                  )}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      player.status === "ACTIVE"
                        ? "bg-green-500/20 text-green-400"
                        : player.status === "SAFE"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : player.status === "TAGGED"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {player.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Winner Display */}
        {gameState.winner && (
          <div className="mt-6 p-6 bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border border-yellow-500/50 rounded-lg text-center">
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-2xl font-bold text-yellow-400 mb-2">
              {gameState.winner === "BLUE"
                ? "Blue Team Wins!"
                : gameState.winner === "WHITE"
                ? "White Team Wins!"
                : "It's a Draw!"}
            </div>
            {gameState.round === 1 && gameState.winner !== "DRAW" && (
              <p className="text-sm text-yellow-200">Round 2 will start with teams switched!</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Configuration UI
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🦢 Swan Chase Configuration
          </h3>
          <p className="text-sm text-slate-400">Assign teams and configure game settings</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-slate-400">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Game Settings */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Game Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("CLASSIC")}
              className={`p-3 rounded-lg border transition-all ${
                mode === "CLASSIC"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
              }`}
            >
              <div className="font-bold">Classic</div>
              <div className="text-xs opacity-80">Single round</div>
            </button>
            <button
              onClick={() => setMode("ROUNDS")}
              className={`p-3 rounded-lg border transition-all ${
                mode === "ROUNDS"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
              }`}
            >
              <div className="font-bold">2 Rounds</div>
              <div className="text-xs opacity-80">Teams switch sides</div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Duration: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
          </label>
          <input
            type="range"
            min="60"
            max="300"
            step="30"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>1 min</span>
            <span>5 min</span>
          </div>
        </div>
      </div>

      {/* Team Assignment */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Team Assignment</h4>
          <button
            onClick={autoAssignTeams}
            className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            🎲 Auto Assign
          </button>
        </div>

        {/* Team Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-2 text-center">
            <div className="text-xs text-blue-300">Blue (Boats)</div>
            <div className="text-2xl font-bold text-blue-400">{blueCount}</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-500/30 rounded-lg p-2 text-center">
            <div className="text-xs text-slate-300">White (Swans)</div>
            <div className="text-2xl font-bold text-slate-400">{whiteCount}</div>
          </div>
          <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-2 text-center">
            <div className="text-xs text-orange-300">Unassigned</div>
            <div className="text-2xl font-bold text-orange-400">{unassignedCount}</div>
          </div>
        </div>

        {/* Player List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {players.map((player) => {
            const assignment = teamAssignments.find((a) => a.playerId === player.id);
            const currentTeam = assignment?.team || "UNASSIGNED";

            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.avatar || "👤"}</span>
                  <div>
                    <div className="font-medium text-white">{player.name}</div>
                    <div className="text-xs text-slate-400">
                      {player.isOnline ? "🟢 Online" : "🔴 Offline"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => assignTeam(player.id, "BLUE")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      currentTeam === "BLUE"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    🚤 Blue
                  </button>
                  <button
                    onClick={() => assignTeam(player.id, "WHITE")}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      currentTeam === "WHITE"
                        ? "bg-slate-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    🦢 White
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={gameState && !isConfiguring ? endGame : startGame}
        disabled={isConfiguring && (!isConnected || blueCount === 0 || whiteCount === 0)}
        className={`w-full py-4 font-bold rounded-lg transition-colors text-lg ${
          gameState && !isConfiguring
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white"
        }`}
      >
        {gameState && !isConfiguring ? (
          "🛑 Stop Swan Chase"
        ) : blueCount === 0 || whiteCount === 0 ? (
          "⚠️ Assign players to both teams"
        ) : !isConnected ? (
          "❌ Not Connected"
        ) : (
          "🚀 Start Swan Chase"
        )}
      </button>
    </div>
  );
}
