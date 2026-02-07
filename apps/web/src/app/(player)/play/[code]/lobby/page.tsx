"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface WorkspaceBranding {
  logo: string | null;
  themeColor: string | null;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionState, setSessionState] = useState<"waiting" | "starting" | "playing">("waiting");
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<WorkspaceBranding>({ logo: null, themeColor: null });
  const [myPlayer, setMyPlayer] = useState<{ name: string; avatar: string } | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

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
      // Store player ID in localStorage for game page rejoin
      if (data.playerId) {
        const playerName = sessionStorage.getItem("playerName");
        const playerAvatar = sessionStorage.getItem("playerAvatar");
        localStorage.setItem(`player-${code.toUpperCase()}`, JSON.stringify({
          id: data.playerId,
          name: playerName,
          avatar: playerAvatar,
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

    socket.on("SESSION_STATE", handleSessionState);
    socket.on("ITEM_STARTED", handleItemStarted);
    socket.on("ERROR", handleError);
    socket.on("PLAYER_JOINED", handlePlayerJoined);
    socket.on("PLAYER_LEFT", handlePlayerLeft);

    console.log("[Lobby] Event listeners registered successfully");

    return () => {
      console.log("[Lobby] Cleaning up event listeners");
      socket.offAny(handleAny);
      socket.off("SESSION_STATE", handleSessionState);
      socket.off("ITEM_STARTED", handleItemStarted);
      socket.off("ERROR", handleError);
      socket.off("PLAYER_JOINED", handlePlayerJoined);
      socket.off("PLAYER_LEFT", handlePlayerLeft);
    };
  }, [socket, code, router]);

  if (error) {
    const themeColor = branding.themeColor || "#3B82F6";
    return (
      <div 
        className="flex-1 flex items-center justify-center p-4"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
        }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-black text-white mb-2">Oops!</h1>
          <p className="text-lg text-white/90 mb-6">{error}</p>
          <button
            onClick={() => router.push("/join")}
            className="px-6 py-3 text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
          >
            Try Again
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
          <div className="text-6xl mb-4 animate-bounce">🔌</div>
          <p className="text-xl font-bold text-white">Connecting...</p>
        </div>
      </div>
    );
  }

  const themeColor = branding.themeColor || "#3B82F6";

  return (
    <div 
      className="flex-1 flex flex-col p-4 relative"
      style={{
        background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
      }}
    >
      {/* My Player Badge - Top Left */}
      {myPlayer && (
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
            <span className="text-2xl">{myPlayer.avatar}</span>
            <span className="font-bold text-white text-lg">{myPlayer.name}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* Workspace Logo */}
          {branding.logo && (
            <div className="flex justify-center mb-6">
              <img
                src={branding.logo}
                alt="Workspace logo"
                className="h-20 object-contain bg-white/10 p-3 rounded-xl backdrop-blur-sm"
              />
            </div>
          )}

        {/* Session Code */}
        <div className="text-center mb-8">
          <p className="text-lg text-white/80 mb-2">Game Code</p>
          <div className="inline-block bg-white/20 backdrop-blur-sm px-8 py-4 rounded-2xl">
            <span className="text-white font-black text-4xl tracking-widest">{code}</span>
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          {sessionState === "waiting" && (
            <>
              <div className="text-5xl mb-3 animate-pulse">⏳</div>
              <h1 className="text-3xl font-black text-white mb-2">Waiting for host...</h1>
              <p className="text-lg text-white/90">The game will start soon!</p>
            </>
          )}
          {sessionState === "starting" && (
            <>
              <div className="text-5xl mb-3 animate-bounce">🎮</div>
              <h1 className="text-3xl font-black text-white mb-2">Get ready!</h1>
              <p className="text-lg text-white/90">The game is starting...</p>
            </>
          )}
        </div>

        {/* Players List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Players</h2>
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span className="text-sm font-bold text-white">{players.length}</span>
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {players.length === 0 ? (
              <p className="text-center text-white/60 py-4">No players yet...</p>
            ) : (
              players.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transform transition-all hover:scale-105"
                  style={{
                    animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
                  }}
                >
                  <div className="text-3xl">{player.avatar}</div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">{player.name}</p>
                  </div>
                  <div className="text-2xl">
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
