"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteSessionButtonProps {
  sessionId: string;
  workspaceId: string;
  sessionName: string;
}

export default function DeleteSessionButton({ 
  sessionId, 
  workspaceId, 
  sessionName 
}: DeleteSessionButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete session");
      }

      // Redirect to sessions list
      router.push(`/workspaces/${workspaceId}/sessions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
      setIsDeleting(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Weet je het zeker?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isDeleting ? "Verwijderen..." : "Ja, verwijder"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="px-3 py-1.5 bg-slate-600 text-white text-sm font-medium rounded hover:bg-slate-500 disabled:opacity-50 transition-colors"
        >
          Annuleren
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 font-medium rounded-lg hover:bg-red-600/30 transition-colors"
    >
      🗑️ Verwijderen
    </button>
  );
}
