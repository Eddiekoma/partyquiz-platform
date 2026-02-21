"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PlayerAvatar, AvatarPicker, generateRandomAvatar } from "@/components/PlayerAvatar";

interface AvailablePlayer {
  id: string;
  name: string;
  avatar: string | null;
  isYou: boolean;
  isAvailable: boolean;
  isLeft?: boolean;      // Player left but can rejoin (has answers)
  hasAnswers?: boolean;  // Player has answered at least one question
}

interface SessionInfo {
  sessionId: string;
  status: string;
  currentPlayer: {
    id: string;
    name: string;
    accessToken: string;
  } | null;
  players: AvailablePlayer[];
}

type JoinMode = "loading" | "auto-rejoin" | "select-player" | "new-player" | "error";

export default function PlayerNamePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const playerToken = searchParams.get("player"); // Permanent player link

  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(() => generateRandomAvatar());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [takenAvatars, setTakenAvatars] = useState<string[]>([]);

  // Join flow state
  const [mode, setMode] = useState<JoinMode>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Check for existing player recognition on mount
  useEffect(() => {
    checkPlayerAccess();
  }, [code, playerToken]);

  const getDeviceIdHash = (): string => {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  };

  const checkPlayerAccess = async () => {
    try {
      // 1. Check if player token in URL (permanent link)
      if (playerToken) {
        const res = await fetch(`/api/sessions/player/${playerToken}`);
        if (res.ok) {
          const data = await res.json();
          // Store player info and go directly to lobby
          sessionStorage.setItem("playerName", data.player.name);
          sessionStorage.setItem("playerAvatar", data.player.avatar || "🎮");
          localStorage.setItem(`player-${code.toUpperCase()}`, JSON.stringify({
            id: data.player.id,
            name: data.player.name,
            accessToken: data.player.accessToken,
          }));
          router.push(`/play/${code.toUpperCase()}/lobby`);
          return;
        }
      }

      // 2. Fetch session and available players
      const deviceId = getDeviceIdHash();
      const res = await fetch(`/api/sessions/code/${code.toUpperCase()}/players`, {
        headers: { "x-device-id": deviceId },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Session not found");
        setMode("error");
        return;
      }

      const data: SessionInfo = await res.json();
      setSessionInfo(data);

      // Collect taken avatars so new player gets a unique one
      const taken = data.players
        .map(p => p.avatar)
        .filter((a): a is string => !!a);
      setTakenAvatars(taken);
      // Regenerate avatar to avoid conflicts with existing players
      setSelectedAvatar(generateRandomAvatar(taken));

      // 3. Check if this device is already a player (active or left)
      if (data.currentPlayer) {
        // Check if the matched player is a "left" player who needs to be reclaimed
        const matchedPlayer = data.players.find(p => p.id === data.currentPlayer!.id);

        if (matchedPlayer?.isLeft) {
          // Player left but device recognized - need to reclaim first
          const claimRes = await fetch(`/api/sessions/code/${code.toUpperCase()}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: data.currentPlayer.id, deviceIdHash: deviceId }),
          });

          if (!claimRes.ok) {
            // Claim failed, show selection screen
            setMode("select-player");
            return;
          }
        }

        // Auto-rejoin: device recognized (active or successfully reclaimed)
        sessionStorage.setItem("playerName", data.currentPlayer.name);
        sessionStorage.setItem("playerAvatar", data.players.find(p => p.id === data.currentPlayer!.id)?.avatar || "🎮");
        localStorage.setItem(`player-${code.toUpperCase()}`, JSON.stringify({
          id: data.currentPlayer.id,
          name: data.currentPlayer.name,
          accessToken: data.currentPlayer.accessToken,
        }));
        router.push(`/play/${code.toUpperCase()}/lobby`);
        return;
      }

      // 4. Check if there are claimable players (unclaimed OR left players who can rejoin)
      const availablePlayers = data.players.filter(p => p.isAvailable && !p.isYou);
      const leftPlayersWithAnswers = data.players.filter(p => p.isLeft && p.hasAnswers);

      if ((availablePlayers.length > 0 || leftPlayersWithAnswers.length > 0) && data.status !== "LOBBY") {
        // Session already started, show player selection
        setMode("select-player");
      } else {
        // Lobby phase or no unclaimed players - show new player form
        setMode("new-player");
      }
    } catch (err) {
      console.error("Error checking player access:", err);
      setError("Could not check session");
      setMode("error");
    }
  };

  const handleSelectPlayer = async () => {
    if (!selectedPlayerId || !sessionInfo) return;

    setLoading(true);
    setError("");

    try {
      const player = sessionInfo.players.find(p => p.id === selectedPlayerId);
      if (!player) {
        setError("Player not found");
        setLoading(false);
        return;
      }

      // Get player's access token and claim with device
      const deviceId = getDeviceIdHash();

      // Find the player's accessToken (need to fetch it)
      const res = await fetch(`/api/sessions/code/${code.toUpperCase()}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: selectedPlayerId, deviceIdHash: deviceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not claim player");
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Store player info
      sessionStorage.setItem("playerName", player.name);
      sessionStorage.setItem("playerAvatar", player.avatar || "🎮");
      localStorage.setItem(`player-${code.toUpperCase()}`, JSON.stringify({
        id: player.id,
        name: player.name,
        accessToken: data.accessToken,
      }));

      router.push(`/play/${code.toUpperCase()}/lobby`);
    } catch (err) {
      console.error("Error selecting player:", err);
      setError("Error selecting player");
      setLoading(false);
    }
  };

  const handleNewPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter a name with at least 2 characters");
      return;
    }

    if (name.trim().length > 20) {
      setError("Name can be at most 20 characters");
      return;
    }

    setLoading(true);

    // Save player info to sessionStorage
    sessionStorage.setItem("playerName", name.trim());
    sessionStorage.setItem("playerAvatar", selectedAvatar);

    // Navigate to lobby (WebSocket will create the player)
    router.push(`/play/${code.toUpperCase()}/lobby`);
  };

  // Loading state
  if (mode === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl sm:text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-lg sm:text-xl text-white/90">Just a moment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (mode === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center px-4">
          <div className="text-5xl sm:text-6xl mb-4">❌</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Oops!</h1>
          <p className="text-base sm:text-lg text-white/90 mb-6">{error}</p>
          <button
            onClick={() => router.push("/join")}
            className="px-6 py-3 text-base sm:text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
          >
            Enter another code
          </button>
        </div>
      </div>
    );
  }

  // Select existing player mode
  if (mode === "select-player" && sessionInfo) {
    // Separate active and left players
    const activePlayers = sessionInfo.players.filter(p => p.isAvailable && !p.isLeft);
    const leftPlayers = sessionInfo.players.filter(p => p.isLeft && p.hasAnswers);

    return (
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-5 sm:mb-6">
            <div className="flex justify-center mb-2"><PlayerAvatar avatar={null} size={48} /></div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">Who are you?</h1>
            <p className="text-base sm:text-lg text-white/80">Select your name to continue playing</p>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6">
            <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto mb-4 -mx-1 px-1">
              {/* Left players who can rejoin - shown first with special styling */}
              {leftPlayers.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-orange-600 px-2">🔄 Rejoin the game:</p>
                  {leftPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all border-2 ${
                        selectedPlayerId === player.id
                          ? "bg-orange-100 ring-4 ring-orange-500 border-orange-500"
                          : "bg-orange-50 hover:bg-orange-100 border-orange-200"
                      }`}
                    >
                      <PlayerAvatar avatar={player.avatar} size={36} />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-base sm:text-lg font-bold text-gray-900 truncate w-full">{player.name}</span>
                        <span className="text-xs text-orange-600">Tap to rejoin</span>
                      </div>
                      {selectedPlayerId === player.id && (
                        <span className="ml-auto text-orange-600 flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Active unclaimed players */}
              {activePlayers.length > 0 && (
                <>
                  {leftPlayers.length > 0 && (
                    <p className="text-sm font-semibold text-gray-500 px-2 pt-2">Or select:</p>
                  )}
                  {activePlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all ${
                        selectedPlayerId === player.id
                          ? "bg-purple-100 ring-4 ring-purple-500"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <PlayerAvatar avatar={player.avatar} size={36} />
                      <span className="text-base sm:text-lg font-bold text-gray-900 truncate">{player.name}</span>
                      {selectedPlayerId === player.id && (
                        <span className="ml-auto text-purple-600 flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium mb-4">{error}</p>
            )}

            <button
              onClick={handleSelectPlayer}
              disabled={!selectedPlayerId || loading}
              className="w-full py-3 sm:py-4 px-6 text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? "One moment..." : "That's me! 👋"}
            </button>

            <div className="text-center mt-3 sm:mt-4">
              <button
                onClick={() => setMode("new-player")}
                className="text-gray-500 hover:text-gray-700 text-sm py-2"
              >
                I'm not listed → New player
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // New player form (default)
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="flex justify-center mb-2"><PlayerAvatar avatar={selectedAvatar} size={56} /></div>
          <h1 className="text-2xl sm:text-4xl font-black text-white mb-1">Join Game</h1>
          <p className="text-base sm:text-lg text-white/80">Code: {code.toUpperCase()}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8">
          <form onSubmit={handleNewPlayer} className="space-y-4 sm:space-y-6">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="Enter your name"
                className="w-full px-4 sm:px-6 py-3 sm:py-4 text-lg sm:text-xl font-bold text-center border-3 sm:border-4 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-200 outline-none transition-all text-gray-900"
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>
              )}
            </div>

            {/* Avatar Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 sm:mb-3">
                Your avatar
              </label>
              <AvatarPicker
                value={selectedAvatar}
                onChange={setSelectedAvatar}
                takenAvatars={takenAvatars}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 sm:py-4 px-6 text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? "Loading..." : "Play! 🎮"}
            </button>
          </form>

          {/* Switch to select mode if players exist */}
          {sessionInfo && sessionInfo.players.filter(p => p.isAvailable).length > 0 && (
            <div className="text-center mt-3 sm:mt-4">
              <button
                onClick={() => setMode("select-player")}
                className="text-gray-500 hover:text-gray-700 text-sm py-2"
              >
                Already played? → Select your name
              </button>
            </div>
          )}
        </div>

        {/* Back Link */}
        <button
          onClick={() => router.push("/join")}
          className="w-full mt-4 text-center text-white/80 hover:text-white transition-colors py-2"
        >
          ← Other code
        </button>
      </div>
    </div>
  );
}
