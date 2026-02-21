"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code || code.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }

    setLoading(true);

    try {
      // Verify code exists (we'll check via WebSocket later)
      // For now, just navigate to the name entry page
      router.push(`/play/${code.toUpperCase()}`);
    } catch (err) {
      setError("Invalid game code");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-2">🎉 PartyQuiz</h1>
          <p className="text-base sm:text-xl text-white/90">Join the fun!</p>
        </div>

        {/* Code Input Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-bold text-gray-700 mb-2">
                Enter Game Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().slice(0, 6);
                  setCode(value);
                  setError("");
                }}
                placeholder="ABC123"
                className="w-full px-4 sm:px-6 py-3 sm:py-4 text-2xl sm:text-3xl font-bold text-center tracking-widest border-3 sm:border-4 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-200 outline-none transition-all uppercase text-gray-900"
                maxLength={6}
                autoComplete="off"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 sm:py-4 px-6 text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? "Joining..." : "Join Game →"}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <p className="text-center text-white/80 text-sm mt-4 sm:mt-6 px-2">
          Ask the host for the game code displayed on their screen
        </p>
      </div>
    </div>
  );
}
