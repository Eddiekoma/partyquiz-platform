"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const AVATARS = ["🎉", "🎮", "🎵", "🌟", "🔥", "💎", "🚀", "🎪", "🎯", "🎲", "👑", "⚡"];

export default function PlayerNamePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  // Validate session code on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const res = await fetch(`/api/sessions/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toUpperCase() }),
        });

        if (res.ok) {
          setSessionValid(true);
        } else {
          setSessionValid(false);
          setError("Game not found or has already ended");
        }
      } catch (err) {
        setSessionValid(false);
        setError("Could not verify game code");
      }
    };

    validateSession();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter a name with at least 2 characters");
      return;
    }

    if (name.trim().length > 20) {
      setError("Name must be 20 characters or less");
      return;
    }

    setLoading(true);

    // Save player info to sessionStorage
    sessionStorage.setItem("playerName", name.trim());
    sessionStorage.setItem("playerAvatar", selectedAvatar);

    // Navigate to lobby
    router.push(`/play/${code.toUpperCase()}/lobby`);
  };

  if (sessionValid === null) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-xl text-white/90">Finding game...</p>
        </div>
      </div>
    );
  }

  if (sessionValid === false) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-black text-white mb-2">Game Not Found</h1>
          <p className="text-lg text-white/90 mb-6">{error}</p>
          <button
            onClick={() => router.push("/join")}
            className="px-6 py-3 text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
          >
            Enter Different Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">{selectedAvatar}</div>
          <h1 className="text-4xl font-black text-white mb-1">Join Game</h1>
          <p className="text-lg text-white/80">Code: {code.toUpperCase()}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                Your Name
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
                Choose Your Avatar
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
              {loading ? "Joining..." : "Enter Game 🎮"}
            </button>
          </form>
        </div>

        {/* Back Link */}
        <button
          onClick={() => router.push("/join")}
          className="w-full mt-4 text-center text-white/80 hover:text-white transition-colors"
        >
          ← Different code
        </button>
      </div>
    </div>
  );
}
