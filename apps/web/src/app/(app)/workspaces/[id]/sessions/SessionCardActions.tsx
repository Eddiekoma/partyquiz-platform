"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SessionCardActionsProps {
  sessionId: string;
  sessionCode: string;
  workspaceId: string;
}

export default function SessionCardActions({ 
  sessionId, 
  sessionCode,
  workspaceId 
}: SessionCardActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      router.refresh();
    } catch (err) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  }

  function handleCancel() {
    setShowConfirm(false);
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "..." : "Yes"}
        </button>
        <button
          onClick={handleCancel}
          className="px-2 py-1 bg-slate-600 text-white text-xs font-medium rounded hover:bg-slate-500"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/host/${sessionCode}`}
        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
      >
        🎮 Open
      </Link>
      <button
        onClick={handleDelete}
        className="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-600/30 text-xs font-medium rounded hover:bg-red-600/30 transition-colors"
      >
        🗑️
      </button>
    </div>
  );
}
