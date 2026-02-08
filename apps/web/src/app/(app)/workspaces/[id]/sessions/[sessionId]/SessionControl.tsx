"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessage, WSMessageType } from "@partyquiz/shared";

interface SessionControlProps {
  session: any;
}

export default function SessionControl({ session }: SessionControlProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection
  const { isConnected, error: wsError, send } = useWebSocket({
    sessionCode: session.code,
    onMessage: (message: WSMessage) => {
      console.log("Received WS message:", message);
      // Refresh page data when session updates
      if (
        message.type === WSMessageType.SESSION_STATE ||
        message.type === WSMessageType.PLAYER_JOINED ||
        message.type === WSMessageType.PLAYER_LEFT ||
        message.type === WSMessageType.ANSWER_COUNT_UPDATED
      ) {
        router.refresh();
      }
    },
    onConnect: () => {
      console.log("WebSocket connected for session:", session.code);
    },
    onDisconnect: () => {
      console.log("WebSocket disconnected");
    },
  });

  async function updateSessionStatus(newStatus: string) {
    setUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${session.workspaceId}/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update session");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update session");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteSession() {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${session.workspaceId}/sessions/${session.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete session");
      }

      router.push(`/workspaces/${session.workspaceId}/sessions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
      setDeleting(false);
    }
  }

  async function exportResults() {
    setExporting(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${session.id}/export?format=csv`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export results");
      }

      // Download the CSV file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch ? filenameMatch[1] : `session-results-${session.code}.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success (could add a success state/message if desired)
      console.log("Results exported successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export results");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-white mb-4">Host Controls</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Export Results (for ended sessions) */}
        {session.status === "ENDED" && (
          <div>
            <p className="text-sm text-slate-400 mb-2">Export Results</p>
            <button
              onClick={exportResults}
              disabled={exporting}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
            >
              {exporting ? "Exporting..." : "📥 Download CSV"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Export all player results with answers, scores, and correctness
            </p>
          </div>
        )}

        {/* Status Controls */}
        <div>
          <p className="text-sm text-slate-400 mb-2">Session Status</p>
          <div className="flex gap-2">
            {session.status === "LOBBY" && (
              <button
                onClick={() => updateSessionStatus("ACTIVE")}
                disabled={updating}
                  className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                >
                  {updating ? "Starting..." : "▶️ Start Session"}
                </button>
            )}

            {session.status === "ACTIVE" && (
              <>
                <button
                  onClick={() => updateSessionStatus("PAUSED")}
                  disabled={updating}
                  className="px-4 py-2 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                >
                  {updating ? "Pausing..." : "⏸️ Pause"}
                </button>
                <button
                  onClick={() => updateSessionStatus("ENDED")}
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                >
                  {updating ? "Ending..." : "⏹️ End Session"}
                </button>
              </>
            )}

            {session.status === "PAUSED" && (
              <>
                <button
                  onClick={() => updateSessionStatus("ACTIVE")}
                  disabled={updating}
                  className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                >
                  {updating ? "Resuming..." : "▶️ Resume"}
                </button>
                <button
                  onClick={() => updateSessionStatus("ENDED")}
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                >
                  {updating ? "Ending..." : "⏹️ End Session"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* WebSocket Info */}
        <div className="pt-4 border-t border-slate-600">
          <p className="text-sm text-slate-400 mb-2">WebSocket Connection</p>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-slate-300">
              {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          {wsError && (
            <p className="text-xs text-red-400 mb-2">Error: {wsError.message}</p>
          )}
          <p className="text-xs text-slate-500 bg-slate-700/50 p-3 rounded font-mono">
            {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'}/ws
          </p>
          <p className="text-xs text-slate-500 mt-2">
            💡 Real-time updates are {isConnected ? 'active' : 'paused'}. Player joins and answers will be reflected automatically.
          </p>
        </div>

        {/* Delete Session */}
        <div className="pt-4 border-t border-slate-600">
          <p className="text-sm text-slate-400 mb-2">Danger Zone</p>
          <button
            onClick={deleteSession}
            disabled={deleting}
            className="px-4 py-2 bg-red-900/30 text-red-400 font-medium rounded-lg border border-red-700 hover:bg-red-900/50 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
          >
            {deleting ? "Deleting..." : "🗑️ Delete Session"}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            This will permanently delete the session, all players, and all answers.
          </p>
        </div>
      </div>
    </div>
  );
}
