"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface WorkspaceBranding {
  logo: string | null;
  themeColor: string | null;
}

interface RecognizedPlayer {
  id: string;
  name: string;
  avatar: string | null;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionState, setSessionState] = useState<"waiting" | "starting" | "playing">("waiting");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [branding, setBranding] = useState<WorkspaceBranding>({ logo: null, themeColor: null });
  const [myPlayer, setMyPlayer] = useState<{ name: string; avatar: string } | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  // Device recognition state
  const [deviceRecognized, setDeviceRecognized] = useState(false);
  const [recognizedPlayer, setRecognizedPlayer] = useState<RecognizedPlayer | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");

  const { socket, isConnected } = useWebSocket();

  // Fetch workspace branding
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        // Get session info to find workspace
        const sessionRes = await fetch(`/api/sessions/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toUpperCase() }),
        });

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          const workspaceId = sessionData.session?.workspaceId;

          if (workspaceId) {
            // Fetch workspace branding (public endpoint for player view)
            const brandingRes = await fetch(`/api/workspaces/${workspaceId}/branding/public`);
            if (brandingRes.ok) {
              const brandingData = await brandingRes.json();
              setBranding({
                logo: brandingData.workspace?.logo || null,
                themeColor: brandingData.workspace?.themeColor || null,
              });
            }
          }
        }
      } catch (err) {
        console.log("Could not fetch branding, using defaults");
      }
    };

    fetchBranding();
  }, [code]);

  // Get player info on mount
  useEffect(() => {
    const playerName = sessionStorage.getItem("playerName");
    const playerAvatar = sessionStorage.getItem("playerAvatar");

    if (!playerName || !playerAvatar) {
      router.push(`/play/${code}`);
      return;
    }

    setMyPlayer({ name: playerName, avatar: playerAvatar });
  }, [code, router]);

  // Join session when socket connects (ONE TIME ONLY)
  useEffect(() => {
    if (!socket || !isConnected || !myPlayer || hasJoined) return;

    console.log("[Lobby] Joining session:", code.toUpperCase());
    socket.emit("JOIN_SESSION", {
      sessionCode: code.toUpperCase(),
      playerName: myPlayer.name,
      avatar: myPlayer.avatar,
      deviceIdHash: getDeviceIdHash(),
    });
    setHasJoined(true);
  }, [socket, isConnected, code, myPlayer, hasJoined]);

  // Set up event listeners SEPARATELY
  useEffect(() => {
    if (!socket) return;

    console.log("[Lobby] Setting up event listeners on socket:", socket.id);

    // Debug: log ALL incoming events
    const handleAny = (eventName: string, ...args: unknown[]) => {
      console.log("[Lobby] Received event:", eventName, args);
    };
    socket.onAny(handleAny);

    // Listen for session state updates
    const handleSessionState = (data: any) => {
      console.log("[Lobby] SESSION_STATE received:", data);
      if (data.players) {
        setPlayers(data.players);
      }
      if (data.status === "in_progress") {
        setSessionState("starting");
      }
      // Store player ID and accessToken in localStorage for game page rejoin
      if (data.playerId) {
        const playerName = sessionStorage.getItem("playerName");
        const playerAvatar = sessionStorage.getItem("playerAvatar");
        localStorage.setItem(`player-${code.toUpperCase()}`, JSON.stringify({
          id: data.playerId,
          name: playerName,
          avatar: playerAvatar,
          accessToken: data.accessToken, // Permanent player link token
        }));
      }
    };

    // Listen for item started (question begins)
    const handleItemStarted = (data: any) => {
      console.log("[Lobby] ITEM_STARTED received:", data);
      setSessionState("playing");
      router.push(`/play/${code}/game`);
    };

    // Listen for errors
    const handleError = (data: any) => {
      console.log("[Lobby] ERROR received:", data);
      setError(data.message || "Failed to join session");
      setErrorCode(data.code || null);
    };

    // Listen for player joined
    const handlePlayerJoined = (data: any) => {
      console.log("[Lobby] PLAYER_JOINED received:", data);
      const playerData = data.player || data;
      if (playerData && playerData.id) {
        setPlayers((prev) => {
          // Avoid duplicates
          if (prev.some(p => p.id === playerData.id)) return prev;
          return [...prev, playerData];
        });
      }
    };

    // Listen for player left
    const handlePlayerLeft = (data: any) => {
      console.log("[Lobby] PLAYER_LEFT received:", data);
      if (data.playerId) {
        setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      }
    };

    // Listen for being kicked by host
    const handlePlayerKicked = (data: any) => {
      console.log("[Lobby] PLAYER_KICKED received:", data);
      // Clear player data from localStorage
      localStorage.removeItem(`player-${code.toUpperCase()}`);
      // Show message and redirect
      alert(data.reason || "You have been removed from the session by the host.");
      router.push("/join");
    };

    // Listen for device recognition
    const handleDeviceRecognized = (data: any) => {
      console.log("[Lobby] DEVICE_RECOGNIZED received:", data);
      setDeviceRecognized(true);
      setRecognizedPlayer(data.existingPlayer);
      setNewPlayerName(data.newPlayerName);
    };

    // Listen for Swan Chase started (minigame starts without a question)
    const handleSwanChaseStarted = (data: any) => {
      console.log("[Lobby] SWAN_CHASE_STARTED received:", data);
      setSessionState("playing");
      router.push(`/play/${code}/game`);
    };

    // Listen for Swan Race started (minigame starts without a question)
    const handleSwanRaceStarted = (data: any) => {
      console.log("[Lobby] SWAN_RACE_STARTED received:", data);
      setSessionState("playing");
      router.push(`/play/${code}/game`);
    };

    socket.on("SESSION_STATE", handleSessionState);
    socket.on("ITEM_STARTED", handleItemStarted);
    socket.on("ERROR", handleError);
    socket.on("PLAYER_JOINED", handlePlayerJoined);
    socket.on("PLAYER_LEFT", handlePlayerLeft);
    socket.on(WSMessageType.PLAYER_KICKED, handlePlayerKicked);
    socket.on(WSMessageType.DEVICE_RECOGNIZED, handleDeviceRecognized);
    socket.on(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
    socket.on(WSMessageType.SWAN_RACE_STARTED, handleSwanRaceStarted);

    console.log("[Lobby] Event listeners registered successfully");

    return () => {
      console.log("[Lobby] Cleaning up event listeners");
      socket.offAny(handleAny);
      socket.off("SESSION_STATE", handleSessionState);
      socket.off("ITEM_STARTED", handleItemStarted);
      socket.off("ERROR", handleError);
      socket.off("PLAYER_JOINED", handlePlayerJoined);
      socket.off("PLAYER_LEFT", handlePlayerLeft);
      socket.off(WSMessageType.PLAYER_KICKED, handlePlayerKicked);
      socket.off(WSMessageType.DEVICE_RECOGNIZED, handleDeviceRecognized);
      socket.off(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
      socket.off(WSMessageType.SWAN_RACE_STARTED, handleSwanRaceStarted);
    };
  }, [socket, code, router]);

  // Handlers for device recognition choice
  const handleContinueAsExisting = () => {
    if (!socket || !recognizedPlayer) return;
    console.log("[Lobby] Continuing as existing player:", recognizedPlayer.id);
    socket.emit(WSMessageType.REJOIN_AS_EXISTING, { playerId: recognizedPlayer.id });
    setDeviceRecognized(false);
    setRecognizedPlayer(null);
  };

  const handleJoinAsNew = () => {
    if (!socket) return;
    console.log("[Lobby] Joining as new player");
    socket.emit(WSMessageType.JOIN_AS_NEW);
    setDeviceRecognized(false);
    setRecognizedPlayer(null);
  };

  // Show device recognized choice screen
  if (deviceRecognized && recognizedPlayer) {
    const themeColor = branding.themeColor || "#3B82F6";
    return (
      <div
        className="flex-1 flex items-center justify-center px-4 py-6"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
        }}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 sm:p-8 max-w-md w-full text-center">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📱</div>
          <h1 className="text-xl sm:text-2xl font-black text-white mb-3 sm:mb-4">
            Welcome back!
          </h1>
          <p className="text-sm sm:text-base text-white/90 mb-4 sm:mb-6">
            This device was already in this session as:
          </p>

          <div className="bg-white/20 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex justify-center"><PlayerAvatar avatar={recognizedPlayer.avatar} size={48} /></div>
            <div className="text-lg sm:text-xl font-bold text-white mt-2">
              {recognizedPlayer.name}
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <button
              onClick={handleContinueAsExisting}
              className="w-full px-5 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-bold text-white bg-green-500 hover:bg-green-400 rounded-xl transition-all active:scale-95"
            >
              ✅ Continue as {recognizedPlayer.name}
            </button>

            <button
              onClick={handleJoinAsNew}
              className="w-full px-5 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95"
            >
              👤 New player ({newPlayerName})
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const themeColor = branding.themeColor || "#3B82F6";
    const isNameTaken = errorCode === "NAME_ALREADY_TAKEN";

    return (
      <div
        className="flex-1 flex items-center justify-center px-4 py-6"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
        }}
      >
        <div className="text-center px-4">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">{isNameTaken ? "👤" : "❌"}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            {isNameTaken ? "Name already in use" : "Oops!"}
          </h1>
          <p className="text-base sm:text-lg text-white/90 mb-4 sm:mb-6">{error}</p>
          <button
            onClick={() => {
              // Clear the stored name so user can enter a new one
              sessionStorage.removeItem("playerName");
              setHasJoined(false);
              setError("");
              setErrorCode(null);
              router.push(`/play/${code}`);
            }}
            className="px-5 sm:px-6 py-3 text-base sm:text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all active:scale-95"
          >
            {isNameTaken ? "Choose another name" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    const themeColor = branding.themeColor || "#3B82F6";
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
        }}
      >
        <div className="text-center">
          <div className="text-5xl sm:text-6xl mb-4 animate-bounce">🔌</div>
          <p className="text-lg sm:text-xl font-bold text-white">Connecting...</p>
        </div>
      </div>
    );
  }

  const themeColor = branding.themeColor || "#3B82F6";

  return (
    <div
      className="flex-1 flex flex-col p-3 sm:p-4 relative"
      style={{
        background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
      }}
    >
      {/* My Player Badge - Top, flow layout on mobile */}
      {myPlayer && (
        <div className="mb-3 sm:mb-0 sm:absolute sm:top-4 sm:left-4 z-10">
          <div className="flex items-center gap-2 sm:gap-3 bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full shadow-lg w-fit">
            <PlayerAvatar avatar={myPlayer.avatar} size={28} />
            <span className="font-bold text-white text-base sm:text-lg truncate max-w-[200px]">{myPlayer.name}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* Workspace Logo */}
          {branding.logo && (
            <div className="flex justify-center mb-4 sm:mb-6">
              <img
                src={branding.logo}
                alt="Workspace logo"
                className="h-14 sm:h-20 object-contain bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-sm"
              />
            </div>
          )}

          {/* Session Code */}
          <div className="text-center mb-5 sm:mb-8">
            <p className="text-sm sm:text-lg text-white/80 mb-1 sm:mb-2">Game Code</p>
            <div className="inline-block bg-white/20 backdrop-blur-sm px-5 sm:px-8 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl">
              <span className="text-white font-black text-2xl sm:text-4xl tracking-widest">{code}</span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center mb-5 sm:mb-8">
            {sessionState === "waiting" && (
              <>
                <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 animate-pulse">⏳</div>
                <h1 className="text-xl sm:text-3xl font-black text-white mb-1 sm:mb-2">Waiting for host...</h1>
                <p className="text-base sm:text-lg text-white/90">The game will start soon!</p>
              </>
            )}
            {sessionState === "starting" && (
              <>
                <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 animate-bounce">🎮</div>
                <h1 className="text-xl sm:text-3xl font-black text-white mb-1 sm:mb-2">Get ready!</h1>
                <p className="text-base sm:text-lg text-white/90">The game is starting...</p>
              </>
            )}
          </div>

          {/* Players List */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-bold text-white">Players</h2>
              <div className="bg-white/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                <span className="text-xs sm:text-sm font-bold text-white">{players.length}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2 max-h-60 sm:max-h-96 overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-center text-white/60 py-4 text-sm sm:text-base">No players yet...</p>
              ) : (
                players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 sm:gap-4 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-2.5 sm:p-4 transition-all"
                    style={{
                      animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
                    }}
                  >
                    <PlayerAvatar avatar={player.avatar} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm sm:text-lg truncate">{player.name}</p>
                    </div>
                    <div className="text-lg sm:text-2xl flex-shrink-0">
                      {index === 0 && "👑"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

function getDeviceIdHash(): string {
  // Generate or retrieve device ID hash
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}
