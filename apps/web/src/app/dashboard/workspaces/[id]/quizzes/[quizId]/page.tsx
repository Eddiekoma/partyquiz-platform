"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Question {
  id: string;
  type: string;
  title: string;
  prompt: string;
  difficulty: number;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  media: Array<{
    id: string;
    mediaType: string;
    provider: string;
  }>;
}

interface QuizItem {
  id: string;
  order: number;
  itemType: string;
  questionId: string | null;
  question: Question | null;
}

interface QuizRound {
  id: string;
  title: string;
  order: number;
  defaultsJson: any;
  items: QuizItem[];
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  rounds: QuizRound[];
  _count: {
    sessions: number;
  };
}

// Sortable Round Component
function SortableRound({
  round,
  index,
  onAddQuestion,
  onRemoveItem,
  onDeleteRound,
  getDifficultyLabel,
  workspaceId,
  quizId,
  onDragEnd,
}: {
  round: QuizRound;
  index: number;
  onAddQuestion: (roundId: string) => void;
  onRemoveItem: (roundId: string, itemId: string) => void;
  onDeleteRound: (roundId: string) => void;
  getDifficultyLabel: (difficulty: number) => string;
  workspaceId: string;
  quizId: string;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: round.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded"
              aria-label="Drag to reorder round"
            >
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </button>
          <h2 className="text-xl font-bold">
            Round {index + 1}: {round.title}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onAddQuestion(round.id)} variant="secondary" size="sm">
            + Add Question
          </Button>
          <Button
            onClick={() => onDeleteRound(round.id)}
            variant="secondary"
            size="sm"
            className="text-red-600"
          >
            Delete Round
          </Button>
        </div>
      </div>        {round.items.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No questions in this round yet</p>
        ) : (
          <DndContext
            sensors={useSensors(
              useSensor(PointerSensor),
              useSensor(KeyboardSensor, {
                coordinateGetter: sortableKeyboardCoordinates,
              })
            )}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={round.items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {round.items.map((item, itemIndex) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    itemIndex={itemIndex}
                    roundId={round.id}
                    onRemove={onRemoveItem}
                    getDifficultyLabel={getDifficultyLabel}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    </div>
  );
}

// Sortable Item Component
function SortableItem({
  item,
  itemIndex,
  roundId,
  onRemove,
  getDifficultyLabel,
}: {
  item: QuizItem;
  itemIndex: number;
  roundId: string;
  onRemove: (roundId: string, itemId: string) => void;
  getDifficultyLabel: (difficulty: number) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
        aria-label="Drag to reorder question"
      >
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </button>
      <span className="text-gray-500 font-mono w-8">{itemIndex + 1}.</span>
      <div className="flex-1">
        <h3 className="font-semibold">{item.question?.title}</h3>
        <div className="flex gap-4 text-sm text-gray-500 mt-1">
          <span>{item.question?.type.replace(/_/g, " ")}</span>
          <span>{getDifficultyLabel(item.question?.difficulty || 3)}</span>
          <span>{item.question?.options.length || 0} options</span>
          {item.question?.media && item.question.media.length > 0 && (
            <span>📎 Has media</span>
          )}
        </div>
      </div>
      <Button
        onClick={() => onRemove(roundId, item.id)}
        variant="secondary"
        size="sm"
        className="text-red-600"
      >
        Remove
      </Button>
    </div>
  );
}

export default function QuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Add round
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState("");

  // Add question to round
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/quizzes/${quizId}`);
      
      if (!response.ok) throw new Error("Failed to load quiz");

      const { quiz: loadedQuiz } = await response.json();
      setQuiz(loadedQuiz);
      setEditTitle(loadedQuiz.title);
      setEditDescription(loadedQuiz.description || "");
    } catch (error) {
      console.error("Failed to load quiz:", error);
      alert("Failed to load quiz");
      router.push(`/dashboard/workspaces/${workspaceId}/quizzes`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuiz = async () => {
    if (!editTitle.trim()) {
      alert("Title is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to update quiz");

      const { quiz: updatedQuiz } = await response.json();
      setQuiz(updatedQuiz);
      setEditMode(false);
      alert("Quiz updated successfully!");
    } catch (error) {
      console.error("Failed to update quiz:", error);
      alert("Failed to update quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRound = async () => {
    if (!newRoundTitle.trim()) {
      alert("Round title is required");
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newRoundTitle.trim() }),
        }
      );

      if (!response.ok) throw new Error("Failed to create round");

      setNewRoundTitle("");
      setShowAddRound(false);
      await loadQuiz();
    } catch (error) {
      console.error("Failed to create round:", error);
      alert("Failed to create round");
    }
  };

  const handleAddQuestion = async (roundId: string) => {
    setSelectedRoundId(roundId);
    setShowQuestionSelector(true);

    // Load available questions
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/questions`);
      if (!response.ok) throw new Error("Failed to load questions");

      const { questions } = await response.json();
      setAvailableQuestions(questions);
    } catch (error) {
      console.error("Failed to load questions:", error);
      alert("Failed to load questions");
    }
  };

  const handleSelectQuestion = async (questionId: string) => {
    if (!selectedRoundId) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/${selectedRoundId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId }),
        }
      );

      if (!response.ok) throw new Error("Failed to add question");

      setShowQuestionSelector(false);
      setSelectedRoundId(null);
      await loadQuiz();
    } catch (error) {
      console.error("Failed to add question:", error);
      alert("Failed to add question");
    }
  };

  const handleRemoveItem = async (roundId: string, itemId: string) => {
    if (!confirm("Remove this question from the round?")) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/${roundId}/items?itemId=${itemId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to remove item");

      await loadQuiz();
    } catch (error) {
      console.error("Failed to remove item:", error);
      alert("Failed to remove item");
    }
  };

  const handleDeleteQuiz = async () => {
    if (!confirm(`Delete quiz "${quiz?.title}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete quiz");
      }

      router.push(`/dashboard/workspaces/${workspaceId}/quizzes`);
    } catch (error: any) {
      console.error("Failed to delete quiz:", error);
      alert(error.message || "Failed to delete quiz");
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!confirm("Delete this round and all its questions?")) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds?roundId=${roundId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete round");

      await loadQuiz();
    } catch (error) {
      console.error("Failed to delete round:", error);
      alert("Failed to delete round");
    }
  };

  const handleDragEndRounds = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !quiz) return;

    const oldIndex = quiz.rounds.findIndex((r) => r.id === active.id);
    const newIndex = quiz.rounds.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update UI
    const newRounds = arrayMove(quiz.rounds, oldIndex, newIndex);
    setQuiz({ ...quiz, rounds: newRounds });

    // Save to server
    try {
      const roundOrders = newRounds.map((round, index) => ({
        roundId: round.id,
        order: index,
      }));

      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundOrders }),
        }
      );

      if (!response.ok) throw new Error("Failed to reorder rounds");
    } catch (error) {
      console.error("Failed to reorder rounds:", error);
      alert("Failed to save new order");
      // Reload to get correct state
      await loadQuiz();
    }
  };

  const handleDragEndItems = async (event: DragEndEvent, roundId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !quiz) return;

    const round = quiz.rounds.find((r) => r.id === roundId);
    if (!round) return;

    const oldIndex = round.items.findIndex((item) => item.id === active.id);
    const newIndex = round.items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update UI
    const newItems = arrayMove(round.items, oldIndex, newIndex);
    const newRounds = quiz.rounds.map((r) =>
      r.id === roundId ? { ...r, items: newItems } : r
    );
    setQuiz({ ...quiz, rounds: newRounds });

    // Save to server
    try {
      const itemOrders = newItems.map((item, index) => ({
        itemId: item.id,
        order: index,
      }));

      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/${roundId}/items/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemOrders }),
        }
      );

      if (!response.ok) throw new Error("Failed to reorder items");
    } catch (error) {
      console.error("Failed to reorder items:", error);
      alert("Failed to save new order");
      // Reload to get correct state
      await loadQuiz();
    }
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ["", "Very Easy", "Easy", "Medium", "Hard", "Very Hard"];
    return labels[difficulty] || "Medium";
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Quiz not found</p>
      </div>
    );
  }

  const totalQuestions = quiz.rounds.reduce((sum, round) => sum + round.items.length, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/quizzes`)}
            variant="secondary"
          >
            ← Back to Quizzes
          </Button>
          <div className="flex gap-3">
            {editMode ? (
              <>
                <Button onClick={() => setEditMode(false)} variant="secondary">
                  Cancel
                </Button>
                <Button onClick={handleUpdateQuiz} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditMode(true)} variant="secondary">
                  Edit Details
                </Button>
                <Button onClick={handleDeleteQuiz} variant="secondary" className="text-red-600">
                  Delete Quiz
                </Button>
              </>
            )}
          </div>
        </div>

        {editMode ? (
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Quiz title..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Quiz description..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
            </div>
          </Card>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
            {quiz.description && <p className="text-gray-600 mb-4">{quiz.description}</p>}
            <div className="flex gap-6 text-sm text-gray-500">
              <span>📋 {quiz.rounds.length} rounds</span>
              <span>❓ {totalQuestions} questions</span>
              <span>🎮 {quiz._count.sessions} sessions played</span>
            </div>
          </>
        )}
      </div>

      {/* Rounds */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEndRounds}
      >
        <SortableContext
          items={quiz.rounds.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {quiz.rounds.map((round, index) => (
              <SortableRound
                key={round.id}
                round={round}
                index={index}
                onAddQuestion={handleAddQuestion}
                onRemoveItem={handleRemoveItem}
                onDeleteRound={handleDeleteRound}
                getDifficultyLabel={getDifficultyLabel}
                workspaceId={workspaceId}
                quizId={quizId}
                onDragEnd={(event) => handleDragEndItems(event, round.id)}
              />
            ))}

            {/* Add Round */}
            {showAddRound ? (
              <Card className="p-6">
            <h3 className="font-bold mb-4">Add New Round</h3>
            <div className="flex gap-3">
              <Input
                value={newRoundTitle}
                onChange={(e) => setNewRoundTitle(e.target.value)}
                placeholder="Round title..."
                className="flex-1"
              />
              <Button onClick={handleCreateRound}>Create</Button>
              <Button onClick={() => setShowAddRound(false)} variant="secondary">
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setShowAddRound(true)} variant="secondary" className="w-full">
            + Add Round
          </Button>
        )}
      </div>

      {/* Question Selector Modal */}
      {showQuestionSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Select Question</h2>
              <Button
                onClick={() => {
                  setShowQuestionSelector(false);
                  setSelectedRoundId(null);
                }}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>

            {availableQuestions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No questions available. Create some questions first!
              </p>
            ) : (
              <div className="space-y-3">
                {availableQuestions.map((question) => (
                  <div
                    key={question.id}
                    onClick={() => handleSelectQuestion(question.id)}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <h3 className="font-semibold mb-1">{question.title}</h3>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>{question.type.replace(/_/g, " ")}</span>
                      <span>{getDifficultyLabel(question.difficulty)}</span>
                      <span>{question.options.length} options</span>
                      {question.media.length > 0 && <span>📎 Has media</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
