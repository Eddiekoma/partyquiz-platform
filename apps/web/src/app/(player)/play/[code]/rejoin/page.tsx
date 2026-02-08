"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";

export default function RejoinPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string).toUpperCase();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");
  const [error, setError] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");

  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Geen geldige rejoin link. Vraag de host om een nieuwe link.");
      return;
    }

    // Validate token with API
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/sessions/rejoin-token/${token}`);
        if (!response.ok) {
          const data = await response.json();
          setStatus("error");
          setError(data.error || "Link is verlopen of ongeldig. Vraag de host om een nieuwe link.");
          return;
        }

        const data = await response.json();
        setPlayerName(data.playerName);

        // Store player data in localStorage for game page
        localStorage.setItem(`player-${code}`, JSON.stringify({
          id: data.playerId,
          name: data.playerName,
          avatar: data.avatar,
        }));

        // Also store in sessionStorage for lobby
        sessionStorage.setItem("playerName", data.playerName);
        sessionStorage.setItem("playerAvatar", data.avatar || "👤");

        setStatus("success");

        // Redirect to game page after short delay
        setTimeout(() => {
          router.push(`/play/${code}/game`);
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError("Er is iets misgegaan. Probeer het opnieuw.");
      }
    };

    validateToken();
  }, [token, code, router]);

  if (status === "validating") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h1 className="text-2xl font-bold text-white mb-2">Even geduld...</h1>
          <p className="text-white/80">Je wordt opnieuw verbonden met het spel</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">Oeps!</h1>
          <p className="text-white/90 mb-6">{error}</p>
          <button
            onClick={() => router.push("/join")}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            Terug naar home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">Welkom terug, {playerName}!</h1>
        <p className="text-white/80">Je wordt doorgestuurd naar het spel...</p>
        <div className="mt-4">
          <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}
