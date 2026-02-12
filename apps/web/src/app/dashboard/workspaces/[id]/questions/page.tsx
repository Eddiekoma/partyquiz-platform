"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

interface QuestionSet {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function QuestionSetsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuestionSets();
  }, [workspaceId]);

  const loadQuestionSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/question-sets`);
      if (!response.ok) throw new Error("Failed to load question sets");
      const data = await response.json();
      setQuestionSets(data.questionSets || []);
    } catch (err) {
      console.error("Failed to load question sets:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSet = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(`/api/workspaces/${workspaceId}/question-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create question set");
      }

      await loadQuestionSets();
      setShowCreateModal(false);
      setFormData({ name: "", description: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create question set");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSet = async () => {
    if (!editingSet || !formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/workspaces/${workspaceId}/question-sets/${editingSet.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update question set");
      }

      await loadQuestionSets();
      setEditingSet(null);
      setFormData({ name: "", description: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update question set");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSet = async (set: QuestionSet) => {
    if (set.name === "Uncategorized") {
      alert("Cannot delete the Uncategorized set");
      return;
    }

    const message = set.questionCount > 0
      ? `Are you sure you want to delete "${set.name}"?\n\n${set.questionCount} question(s) will be moved to the Uncategorized set.`
      : `Are you sure you want to delete "${set.name}"?`;

    if (!confirm(message)) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/question-sets/${set.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete question set");
      }

      await loadQuestionSets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete question set");
    }
  };

  const openEditModal = (set: QuestionSet) => {
    setEditingSet(set);
    setFormData({ name: set.name, description: set.description || "" });
    setError("");
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingSet(null);
    setFormData({ name: "", description: "" });
    setError("");
  };

  const totalQuestions = questionSets.reduce((sum, set) => sum + set.questionCount, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Question Bank</h1>
          <p className="text-slate-400">
            {questionSets.length} set{questionSets.length !== 1 ? "s" : ""} • {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setShowCreateModal(true); setError(""); }}>
            + Create Set
          </Button>
        </div>
      </div>

      {/* Question Sets Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-400">Loading question sets...</p>
        </div>
      ) : questionSets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold mb-2 text-white">No question sets</h3>
          <p className="text-slate-400 mb-6">Create your first question set to organize your questions</p>
          <Button onClick={() => setShowCreateModal(true)}>+ Create Set</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questionSets.map((set) => (
            <div
              key={set.id}
              className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {set.name === "Uncategorized" ? "📁" : "📂"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">{set.name}</h3>
                    <p className="text-sm text-slate-400">
                      {set.questionCount} question{set.questionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {set.name !== "Uncategorized" && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(set);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSet(set);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {set.description && (
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{set.description}</p>
              )}

              <div className="flex gap-2 mt-auto pt-3 border-t border-slate-700/50">
                <Link
                  href={`/dashboard/workspaces/${workspaceId}/questions/sets/${set.id}`}
                  className="flex-1"
                >
                  <Button variant="secondary" className="w-full text-sm">
                    View Questions
                  </Button>
                </Link>
                <Link
                  href={`/dashboard/workspaces/${workspaceId}/questions/new?setId=${set.id}`}
                >
                  <Button className="text-sm">+ Add</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSet) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingSet ? "Edit Question Set" : "Create Question Set"}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Music Trivia, Geography, etc."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={editingSet?.name === "Uncategorized"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this set"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={closeModals}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={editingSet ? handleUpdateSet : handleCreateSet}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Saving..." : editingSet ? "Save Changes" : "Create Set"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
