"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";

// Question types - matches the QuestionType enum in @partyquiz/shared (24 types + legacy)
type QuestionTypeValue =
  // === TEXT QUESTIONS (7) ===
  | "MC_SINGLE"
  | "MC_MULTIPLE"
  | "MC_ORDER"
  | "TRUE_FALSE"
  | "OPEN_TEXT"
  | "NUMERIC"
  | "SLIDER"
  // === PHOTO QUESTIONS (7) ===
  | "PHOTO_MC_SINGLE"
  | "PHOTO_MC_MULTIPLE"
  | "PHOTO_MC_ORDER"
  | "PHOTO_TRUE_FALSE"
  | "PHOTO_OPEN_TEXT"
  | "PHOTO_NUMERIC"
  | "PHOTO_SLIDER"
  // === AUDIO QUESTIONS (2) ===
  | "AUDIO_QUESTION"
  | "AUDIO_OPEN"
  // === VIDEO QUESTIONS (2) ===
  | "VIDEO_QUESTION"
  | "VIDEO_OPEN"
  // === SPOTIFY MUSIC (3) ===
  | "MUSIC_GUESS_TITLE"
  | "MUSIC_GUESS_ARTIST"
  | "MUSIC_GUESS_YEAR"
  // === YOUTUBE VIDEOS (3) ===
  | "YOUTUBE_SCENE_QUESTION"
  | "YOUTUBE_NEXT_LINE"
  | "YOUTUBE_WHO_SAID_IT"
  // === LEGACY (backwards compatibility) ===
  | "ESTIMATION"
  | "ORDER"
  | "POLL"
  | "PHOTO_QUESTION"
  | "PHOTO_OPEN";

type Difficulty = 1 | 2 | 3 | 4 | 5;
type Status = "DRAFT" | "PUBLISHED";

interface Question {
  id: string;
  type: QuestionTypeValue;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  status: Status;
  tagsJson: unknown;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  options?: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    order: number;
  }>;
  media?: Array<{
    id: string;
    provider: string;
    mediaType: string;
    reference: unknown;
  }>;
}

interface QuestionSet {
  id: string;
  name: string;
  description: string | null;
}

const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  // === TEXT QUESTIONS (7) ===
  MC_SINGLE: "Multiple Choice",
  MC_MULTIPLE: "Multiple Choice (Multi)",
  MC_ORDER: "Put in Order",
  TRUE_FALSE: "True/False",
  OPEN_TEXT: "Open Text",
  NUMERIC: "Numeric",
  SLIDER: "Slider",
  // === PHOTO QUESTIONS (7) ===
  PHOTO_MC_SINGLE: "Photo MC",
  PHOTO_MC_MULTIPLE: "Photo MC (Multi)",
  PHOTO_MC_ORDER: "Photo Order",
  PHOTO_TRUE_FALSE: "Photo True/False",
  PHOTO_OPEN_TEXT: "Photo Open",
  PHOTO_NUMERIC: "Photo Numeric",
  PHOTO_SLIDER: "Photo Slider",
  // === AUDIO QUESTIONS (2) ===
  AUDIO_QUESTION: "Audio Question",
  AUDIO_OPEN: "Audio Open",
  // === VIDEO QUESTIONS (2) ===
  VIDEO_QUESTION: "Video Question",
  VIDEO_OPEN: "Video Open",
  // === SPOTIFY MUSIC (3) ===
  MUSIC_GUESS_TITLE: "Guess the Song",
  MUSIC_GUESS_ARTIST: "Guess the Artist",
  MUSIC_GUESS_YEAR: "Guess the Year",
  // === YOUTUBE VIDEOS (3) ===
  YOUTUBE_SCENE_QUESTION: "Video Scene",
  YOUTUBE_NEXT_LINE: "Next Line",
  YOUTUBE_WHO_SAID_IT: "Who Said It?",
  // === LEGACY (backwards compatibility) ===
  ESTIMATION: "Estimation",
  ORDER: "Order",
  POLL: "Poll",
  PHOTO_QUESTION: "Photo Question",
  PHOTO_OPEN: "Photo Open Text",
};

const QUESTION_TYPE_ICONS: Record<QuestionTypeValue, string> = {
  // === TEXT QUESTIONS (7) ===
  MC_SINGLE: "🔘",
  MC_MULTIPLE: "☑️",
  MC_ORDER: "📊",
  TRUE_FALSE: "✅",
  OPEN_TEXT: "✏️",
  NUMERIC: "🔢",
  SLIDER: "🎚️",
  // === PHOTO QUESTIONS (7) ===
  PHOTO_MC_SINGLE: "📷",
  PHOTO_MC_MULTIPLE: "📷",
  PHOTO_MC_ORDER: "📷",
  PHOTO_TRUE_FALSE: "📷",
  PHOTO_OPEN_TEXT: "📷",
  PHOTO_NUMERIC: "📷",
  PHOTO_SLIDER: "�",
  // === AUDIO QUESTIONS (2) ===
  AUDIO_QUESTION: "🔊",
  AUDIO_OPEN: "🔊",
  // === VIDEO QUESTIONS (2) ===
  VIDEO_QUESTION: "🎬",
  VIDEO_OPEN: "🎬",
  // === SPOTIFY MUSIC (3) ===
  MUSIC_GUESS_TITLE: "🎵",
  MUSIC_GUESS_ARTIST: "🎤",
  MUSIC_GUESS_YEAR: "📅",
  // === YOUTUBE VIDEOS (3) ===
  YOUTUBE_SCENE_QUESTION: "▶️",
  YOUTUBE_NEXT_LINE: "💬",
  YOUTUBE_WHO_SAID_IT: "🗣️",
  // === LEGACY (backwards compatibility) ===
  ESTIMATION: "🎯",
  ORDER: "📊",
  POLL: "📋",
  PHOTO_QUESTION: "📷",
  PHOTO_OPEN: "📷",
};

export default function QuestionSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const setId = params.setId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Edit set name modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingSet, setSavingSet] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<QuestionTypeValue | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadQuestions();
  }, [workspaceId, setId, typeFilter, difficultyFilter, statusFilter, tagFilter, searchQuery, page]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const searchParams = new URLSearchParams();
      if (typeFilter !== "ALL") searchParams.append("type", typeFilter);
      if (difficultyFilter !== "ALL") searchParams.append("difficulty", difficultyFilter.toString());
      if (statusFilter !== "ALL") searchParams.append("status", statusFilter);
      if (tagFilter) searchParams.append("tag", tagFilter);
      if (searchQuery) searchParams.append("search", searchQuery);
      searchParams.append("page", page.toString());

      const response = await fetch(
        `/api/workspaces/${workspaceId}/question-sets/${setId}/questions?${searchParams}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          router.push(`/dashboard/workspaces/${workspaceId}/questions`);
          return;
        }
        throw new Error("Failed to load questions");
      }

      const data = await response.json();
      setQuestions(data.questions || []);
      setQuestionSet(data.questionSet || null);
      setTotalPages(data.pagination?.totalPages || 1);
      setAvailableTags(data.filters?.availableTags || []);
    } catch (error) {
      console.error("Failed to load questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      const checkResponse = await fetch(
        `/api/workspaces/${workspaceId}/questions/${questionId}?check=true`,
        { method: "DELETE" }
      );

      if (!checkResponse.ok) {
        throw new Error("Failed to check question usage");
      }

      const usage = await checkResponse.json();
      
      let confirmMessage = "Are you sure you want to delete this question?";
      
      if (usage.usedInQuizzes && usage.usedInQuizzes.length > 0) {
        const quizNames = usage.usedInQuizzes.map((q: { title: string }) => `• ${q.title}`).join("\n");
        confirmMessage = `⚠️ This question is used in ${usage.usedInQuizzes.length} quiz(zes):\n\n${quizNames}\n\nDeleting this question will also remove it from these quizzes.\n\nAre you sure you want to continue?`;
      }

      if (!confirm(confirmMessage)) return;

      const response = await fetch(`/api/workspaces/${workspaceId}/questions/${questionId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete question");
      
      const result = await response.json();
      
      if (result.removedFromQuizzes?.length > 0) {
        alert(`Question deleted and removed from ${result.removedFromQuizzes.length} quiz(zes).`);
      }
      
      loadQuestions();
    } catch (error) {
      console.error("Failed to delete question:", error);
      alert("Failed to delete question");
    }
  };

  const handleOpenEditModal = () => {
    if (questionSet) {
      setEditName(questionSet.name);
      setEditDescription(questionSet.description || "");
      setShowEditModal(true);
    }
  };

  const handleSaveSet = async () => {
    if (!editName.trim()) {
      alert("Name is required");
      return;
    }

    try {
      setSavingSet(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/question-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update question set");
      }

      const { questionSet: updatedSet } = await response.json();
      setQuestionSet(updatedSet);
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update question set:", error);
      alert(error instanceof Error ? error.message : "Failed to update question set");
    } finally {
      setSavingSet(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/questions/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: selectedQuestions.length > 0 ? selectedQuestions : questions.map(q => q.id),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export questions");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "questions-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert(`Successfully exported ${selectedQuestions.length > 0 ? selectedQuestions.length : questions.length} question(s)!`);
      setSelectedQuestions([]);
    } catch (error) {
      console.error("Export error:", error);
      alert(error instanceof Error ? error.message : "Failed to export questions");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch(`/api/workspaces/${workspaceId}/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          options: {
            skipDuplicates: true,
            questionSetId: setId,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import questions");
      }

      const result = await response.json();
      alert(result.message || `Imported ${result.imported} question(s)`);
      
      loadQuestions();
      event.target.value = "";
    } catch (error) {
      console.error("Import error:", error);
      alert(error instanceof Error ? error.message : "Failed to import questions");
    } finally {
      setImporting(false);
    }
  };

  const getDifficultyLabel = (difficulty: Difficulty): string => {
    const labels: Record<Difficulty, string> = {
      1: "Very Easy",
      2: "Easy",
      3: "Medium",
      4: "Hard",
      5: "Very Hard",
    };
    return labels[difficulty];
  };

  const getDifficultyColor = (difficulty: Difficulty) => {
    if (difficulty <= 2) return "text-green-400 bg-green-900/30 border-green-700/50";
    if (difficulty === 3) return "text-yellow-400 bg-yellow-900/30 border-yellow-700/50";
    return "text-red-400 bg-red-900/30 border-red-700/50";
  };

  const getStatusColor = (status: Status) => {
    return status === "PUBLISHED"
      ? "text-blue-400 bg-blue-900/30 border-blue-700/50"
      : "text-slate-400 bg-slate-800/50 border-slate-700/50";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb & Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/workspaces/${workspaceId}/questions`}
          className="text-sm text-slate-400 hover:text-white transition-colors mb-2 inline-block"
        >
          ← Back to Question Sets
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">
                {questionSet?.name || "Loading..."}
              </h1>
              {questionSet && (
                <button
                  onClick={handleOpenEditModal}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title="Edit set name"
                >
                  ✏️
                </button>
              )}
            </div>
            {questionSet?.description && (
              <p className="text-slate-400 mt-1">{questionSet.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <label htmlFor="import-file">
              <Button
                variant="secondary"
                disabled={importing}
                onClick={() => document.getElementById("import-file")?.click()}
              >
                {importing ? "Importing..." : "📥 Import"}
              </Button>
            </label>
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />

            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={exporting || questions.length === 0}
            >
              {exporting ? "Exporting..." : `📤 Export${selectedQuestions.length > 0 ? ` (${selectedQuestions.length})` : ""}`}
            </Button>

            <Link href={`/dashboard/workspaces/${workspaceId}/questions/new?setId=${setId}`}>
              <Button>+ Create Question</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-xl mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as QuestionTypeValue | "ALL");
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => {
              const value = e.target.value;
              setDifficultyFilter(value === "ALL" ? "ALL" : parseInt(value) as Difficulty);
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="ALL">All Difficulties</option>
            <option value="1">Very Easy</option>
            <option value="2">Easy</option>
            <option value="3">Medium</option>
            <option value="4">Hard</option>
            <option value="5">Very Hard</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Status | "ALL");
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-900/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        {availableTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-slate-400 py-1">Tags:</span>
            <button
              onClick={() => {
                setTagFilter("");
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                !tagFilter
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500"
              }`}
            >
              All
            </button>
            {availableTags.slice(0, 10).map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setTagFilter(tag);
                  setPage(1);
                }}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  tagFilter === tag
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-400">Loading questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold mb-2 text-white">No questions in this set</h3>
          <p className="text-slate-400 mb-6">
            {searchQuery || typeFilter !== "ALL" || statusFilter !== "ALL"
              ? "Try adjusting your filters"
              : "Create your first question to get started"}
          </p>
          <Link href={`/dashboard/workspaces/${workspaceId}/questions/new?setId=${setId}`}>
            <Button>+ Create Question</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {questions.map((question) => (
              <div key={question.id} className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <QuestionTypeBadge type={question.type} size="md" showLabel={false} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-semibold text-lg text-white">{question.title}</h3>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link href={`/dashboard/workspaces/${workspaceId}/questions/${question.id}/edit`}>
                          <button className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors">
                            Edit
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(question.id)}
                          className="px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {question.prompt && (
                      <p className="text-sm text-slate-400 mb-2">{question.prompt}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                      <QuestionTypeBadge type={question.type} size="sm" />
                      <span className={`px-2 py-1 rounded border ${getDifficultyColor(question.difficulty)}`}>
                        {getDifficultyLabel(question.difficulty)}
                      </span>
                      <span className={`px-2 py-1 rounded border ${getStatusColor(question.status)}`}>
                        {question.status}
                      </span>
                      {question.options && question.options.length > 0 && (
                        <span className="text-slate-400">📝 {question.options.length} options</span>
                      )}
                      {question.media && question.media.length > 0 && (
                        <span className="text-slate-400">📎 {question.media.length} media</span>
                      )}
                    </div>

                    {(() => {
                      const tags = Array.isArray(question.tagsJson) 
                        ? question.tagsJson 
                        : typeof question.tagsJson === 'string'
                          ? JSON.parse(question.tagsJson)
                          : [];
                      return tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="text-xs text-slate-500">
                      Created by {question.creator.name || question.creator.email}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                variant="secondary"
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                variant="secondary"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Set Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-white">Edit Question Set</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter set name"
                  className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-700 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(false)}
                disabled={savingSet}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSet}
                disabled={savingSet || !editName.trim()}
              >
                {savingSet ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
