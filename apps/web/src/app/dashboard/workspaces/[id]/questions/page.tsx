"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

type QuestionType =
  | "MC_SINGLE"
  | "MC_MULTIPLE"
  | "TRUE_FALSE"
  | "OPEN_TEXT"
  | "ESTIMATION"
  | "ORDER"
  | "PHOTO_QUESTION"
  | "AUDIO_QUESTION"
  | "VIDEO_QUESTION"
  | "MUSIC_INTRO"
  | "MUSIC_SNIPPET"
  | "POLL"
  | "PHOTO_OPEN"
  | "AUDIO_OPEN"
  | "VIDEO_OPEN";

type Difficulty = 1 | 2 | 3 | 4 | 5;
type Status = "DRAFT" | "PUBLISHED";

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  status: Status;
  tagsJson: any;
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
    reference: any;
  }>;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MC_SINGLE: "Multiple Choice (Single)",
  MC_MULTIPLE: "Multiple Choice (Multiple)",
  TRUE_FALSE: "True/False",
  OPEN_TEXT: "Open Text",
  ESTIMATION: "Estimation",
  ORDER: "Order",
  PHOTO_QUESTION: "Photo Question",
  AUDIO_QUESTION: "Audio Question",
  VIDEO_QUESTION: "Video Question",
  MUSIC_INTRO: "Music Intro",
  MUSIC_SNIPPET: "Music Snippet",
  POLL: "Poll",
  PHOTO_OPEN: "Photo Open",
  AUDIO_OPEN: "Audio Open",
  VIDEO_OPEN: "Video Open",
};

const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  MC_SINGLE: "☑️",
  MC_MULTIPLE: "☑️",
  TRUE_FALSE: "✅",
  OPEN_TEXT: "📝",
  ESTIMATION: "🎯",
  ORDER: "🔢",
  PHOTO_QUESTION: "🖼️",
  AUDIO_QUESTION: "🎵",
  VIDEO_QUESTION: "🎬",
  MUSIC_INTRO: "🎼",
  MUSIC_SNIPPET: "🎶",
  POLL: "📊",
  PHOTO_OPEN: "📷",
  AUDIO_OPEN: "🎙️",
  VIDEO_OPEN: "📹",
};

export default function QuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<QuestionType | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "ALL" | 1 | 2 | 3 | 4 | 5>("ALL");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadQuestions();
  }, [workspaceId, typeFilter, difficultyFilter, statusFilter, tagFilter, searchQuery, page]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (difficultyFilter !== "ALL") params.append("difficulty", difficultyFilter.toString());
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (tagFilter) params.append("tag", tagFilter);
      if (searchQuery) params.append("search", searchQuery);
      params.append("page", page.toString());

      const response = await fetch(`/api/workspaces/${workspaceId}/questions?${params}`);
      if (!response.ok) throw new Error("Failed to load questions");

      const data = await response.json();
      setQuestions(data.questions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setAvailableTags(data.filters?.availableTags || []);
    } catch (error) {
      console.error("Failed to load questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/questions/${questionId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete question");
      loadQuestions();
    } catch (error) {
      console.error("Failed to delete question:", error);
      alert("Failed to delete question");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/questions/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: selectedQuestions.length > 0 ? selectedQuestions : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export questions");
      }

      // Download file
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

      // Read file
      const text = await file.text();
      const data = JSON.parse(text);

      // Import questions
      const response = await fetch(`/api/workspaces/${workspaceId}/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          options: {
            skipDuplicates: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import questions");
      }

      const result = await response.json();
      alert(result.message || `Imported ${result.imported} question(s)`);
      
      // Reload questions
      loadQuestions();
      
      // Reset file input
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
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Question Bank</h1>
          <p className="text-slate-400">Create and manage quiz questions</p>
        </div>
        <div className="flex gap-2">
          {/* Import Button */}
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

          {/* Export Button */}
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : `📤 Export${selectedQuestions.length > 0 ? ` (${selectedQuestions.length})` : ""}`}
          </Button>

          {/* Create Button */}
          <Link href={`/dashboard/workspaces/${workspaceId}/questions/new`}>
            <Button>+ Create Question</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-xl mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
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

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as QuestionType | "ALL");
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

          {/* Difficulty Filter */}
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

          {/* Status Filter */}
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

        {/* Tag Filter */}
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
          <h3 className="text-xl font-semibold mb-2 text-white">No questions found</h3>
          <p className="text-slate-400 mb-6">
            {searchQuery || typeFilter !== "ALL" || statusFilter !== "ALL"
              ? "Try adjusting your filters"
              : "Create your first question to get started"}
          </p>
          <Link href={`/dashboard/workspaces/${workspaceId}/questions/new`}>
            <Button>+ Create Question</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {questions.map((question) => (
              <div key={question.id} className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0">
                    {QUESTION_TYPE_ICONS[question.type]}
                  </div>

                  {/* Content */}
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
                      <span className="text-slate-400">{QUESTION_TYPE_LABELS[question.type]}</span>
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

          {/* Pagination */}
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
    </div>
  );
}
