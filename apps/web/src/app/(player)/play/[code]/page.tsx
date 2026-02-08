"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const AVATARS = ["🎉", "🎮", "🎵", "🌟", "🔥", "💎", "🚀", "🎪", "🎯", "🎲", "👑", "⚡"];

interface AvailablePlayer {
  id: string;
  name: string;
  avatar: string | null;
  isYou: boolean;
  isAvailable: boolean;
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
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
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
        setError(data.error || "Sessie niet gevonden");
        setMode("error");
        return;
      }

      const data: SessionInfo = await res.json();
      setSessionInfo(data);

      // 3. Check if this device is already a player
      if (data.currentPlayer) {
        // Auto-rejoin: device recognized
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

      // 4. Check if there are unclaimed players to select from
      const availablePlayers = data.players.filter(p => p.isAvailable && !p.isYou);
      if (availablePlayers.length > 0 && data.status !== "LOBBY") {
        // Session already started, show player selection
        setMode("select-player");
      } else {
        // Lobby phase or no unclaimed players - show new player form
        setMode("new-player");
      }
    } catch (err) {
      console.error("Error checking player access:", err);
      setError("Kon sessie niet controleren");
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
        setError("Speler niet gevonden");
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
        setError(data.error || "Kon speler niet claimen");
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
      setError("Fout bij selecteren speler");
      setLoading(false);
    }
  };

  const handleNewPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Vul een naam in van minimaal 2 tekens");
      return;
    }

    if (name.trim().length > 20) {
      setError("Naam mag maximaal 20 tekens zijn");
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
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-xl text-white/90">Even kijken...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (mode === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-black text-white mb-2">Oeps!</h1>
          <p className="text-lg text-white/90 mb-6">{error}</p>
          <button
            onClick={() => router.push("/join")}
            className="px-6 py-3 text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
          >
            Andere code invoeren
          </button>
        </div>
      </div>
    );
  }

  // Select existing player mode
  if (mode === "select-player" && sessionInfo) {
    const availablePlayers = sessionInfo.players.filter(p => p.isAvailable);
    
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">👤</div>
            <h1 className="text-3xl font-black text-white mb-1">Wie ben jij?</h1>
            <p className="text-lg text-white/80">Selecteer je naam om verder te spelen</p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    selectedPlayerId === player.id
                      ? "bg-purple-100 ring-4 ring-purple-500"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-3xl">{player.avatar || "👤"}</span>
                  <span className="text-lg font-bold text-gray-900">{player.name}</span>
                  {selectedPlayerId === player.id && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium mb-4">{error}</p>
            )}

            <button
              onClick={handleSelectPlayer}
              disabled={!selectedPlayerId || loading}
              className="w-full py-4 px-6 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Even geduld..." : "Dit ben ik! 👋"}
            </button>

            <div className="text-center mt-4">
              <button
                onClick={() => setMode("new-player")}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Ik sta er niet bij → Nieuwe speler
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // New player form (default)
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">{selectedAvatar}</div>
          <h1 className="text-4xl font-black text-white mb-1">Meedoen</h1>
          <p className="text-lg text-white/80">Code: {code.toUpperCase()}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleNewPlayer} className="space-y-6">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                Jouw naam
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="Vul je naam in"
                className="w-full px-6 py-4 text-xl font-bold text-center border-4 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-200 outline-none transition-all"
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
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Kies je avatar
              </label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`text-3xl p-2 rounded-xl transition-all ${
                      selectedAvatar === avatar
                        ? "bg-purple-100 ring-4 ring-purple-500 scale-110"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-4 px-6 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              {loading ? "Laden..." : "Spelen! 🎮"}
            </button>
          </form>

          {/* Switch to select mode if players exist */}
          {sessionInfo && sessionInfo.players.filter(p => p.isAvailable).length > 0 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setMode("select-player")}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Al meegedaan? → Selecteer je naam
              </button>
            </div>
          )}
        </div>

        {/* Back Link */}
        <button
          onClick={() => router.push("/join")}
          className="w-full mt-4 text-center text-white/80 hover:text-white transition-colors"
        >
          ← Andere code
        </button>
      </div>
    </div>
  );
}
