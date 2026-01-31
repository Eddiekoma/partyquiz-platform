"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  rounds: Array<{
    id: string;
    title: string;
    order: number;
    _count: {
      items: number;
    };
  }>;
  _count: {
    sessions: number;
  };
}

export default function QuizzesPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, [search]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes?${queryParams.toString()}`
      );

      if (!response.ok) throw new Error("Failed to load quizzes");

      const data = await response.json();
      setQuizzes(data.quizzes);
    } catch (error) {
      console.error("Failed to load quizzes:", error);
      alert("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    const title = prompt("Enter quiz title:");
    if (!title || !title.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) throw new Error("Failed to create quiz");

      const { quiz } = await response.json();
      router.push(`/dashboard/workspaces/${workspaceId}/quizzes/${quiz.id}`);
    } catch (error) {
      console.error("Failed to create quiz:", error);
      alert("Failed to create quiz");
    } finally {
      setCreating(false);
    }
  };

  const getTotalQuestions = (quiz: Quiz) => {
    return quiz.rounds.reduce((sum, round) => sum + round._count.items, 0);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quizzes</h1>
          <p className="text-gray-600">Create and manage your quiz collections</p>
        </div>
        <Button onClick={handleCreateQuiz} disabled={creating}>
          {creating ? "Creating..." : "+ New Quiz"}
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <Input
          type="text"
          placeholder="Search quizzes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </Card>

      {/* Quiz List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 mb-4">No quizzes found</p>
          <Button onClick={handleCreateQuiz} disabled={creating}>
            Create Your First Quiz
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/dashboard/workspaces/${workspaceId}/quizzes/${quiz.id}`}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <h3 className="text-xl font-bold mb-2 line-clamp-2">{quiz.title}</h3>
                {quiz.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {quiz.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>📋 {quiz.rounds.length} rounds</span>
                    <span>❓ {getTotalQuestions(quiz)} questions</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>🎮 {quiz._count.sessions} sessions</span>
                    <span className="text-xs">
                      Updated {new Date(quiz.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {quiz.rounds.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-amber-600">⚠️ No rounds yet</p>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
