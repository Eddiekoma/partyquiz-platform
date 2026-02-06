"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  _count: {
    items: number;
  };
}

interface NewSessionPageProps {
  params: Promise<{ id: string }>;
}

export default function NewSessionPage({ params }: NewSessionPageProps) {
  // Next.js 16: use() hook to unwrap params Promise in client components
  const resolvedParams = use(params);
  
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load quizzes
  useEffect(() => {
    async function loadQuizzes() {
      try {
        const res = await fetch(`/api/workspaces/${resolvedParams.id}/quizzes`);
        if (!res.ok) throw new Error("Failed to load quizzes");
        const data = await res.json();
        setQuizzes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quizzes");
      } finally {
        setLoading(false);
      }
    }
    loadQuizzes();
  }, [resolvedParams.id]);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuizId) {
      setError("Please select a quiz");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      const session = await res.json();
      
      // Redirect to session page
      router.push(`/workspaces/${resolvedParams.id}/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No quizzes available</h2>
            <p className="text-gray-600 mb-6">You need to create a quiz before starting a session.</p>
            <Link
              href={`/workspaces/${resolvedParams.id}/quizzes/new`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Create Quiz
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/workspaces/${resolvedParams.id}/sessions`}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Sessions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create Live Session</h1>
          <p className="text-gray-600 mt-1">Select a quiz to start a live session</p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateSession} className="bg-white border border-gray-200 rounded-lg p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Quiz</label>
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <label
                  key={quiz.id}
                  className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedQuizId === quiz.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz"
                    value={quiz.id}
                    checked={selectedQuizId === quiz.id}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                      {quiz.description && <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>}
                      <p className="text-xs text-gray-500 mt-2">
                        {quiz._count.items} {quiz._count.items === 1 ? "item" : "items"}
                      </p>
                    </div>
                    {selectedQuizId === quiz.id && (
                      <div className="ml-4">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!selectedQuizId || creating}
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
            <Link
              href={`/workspaces/${resolvedParams.id}/sessions`}
              className="px-4 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
