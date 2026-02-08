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
  explanation: string | null;
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
  minigameType: string | null;
  settingsJson: Record<string, any> | null;
  question: Question | null;
}

interface QuizRound {
  id: string;
  title: string;
  order: number;
  defaultsJson: any;
  items: QuizItem[];
}

interface ScoringSettings {
  basePoints?: number;
  timeBonusEnabled?: boolean;
  timeBonusPercentage?: number;
  streakBonusEnabled?: boolean;
  streakBonusPoints?: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  rounds: QuizRound[];
  scoringSettingsJson?: ScoringSettings | null;
  _count: {
    sessions: number;
  };
}

// Sortable Round Component
function SortableRound({
  round,
  index,
  onAddQuestion,
  onAddMinigame,
  onRemoveItem,
  onEditSettings,
  onDeleteRound,
  getDifficultyLabel,
  workspaceId,
  quizId,
  onDragEnd,
}: {
  round: QuizRound;
  index: number;
  onAddQuestion: (roundId: string) => void;
  onAddMinigame: (roundId: string, minigameType: string) => void;
  onRemoveItem: (roundId: string, itemId: string) => void;
  onEditSettings: (roundId: string, item: QuizItem) => void;
  onDeleteRound: (roundId: string) => void;
  getDifficultyLabel: (difficulty: number) => string;
  workspaceId: string;
  quizId: string;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
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
              className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-700 rounded"
              aria-label="Drag to reorder round"
            >
              <svg
                className="w-5 h-5 text-slate-500"
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
          <div className="relative">
            <Button onClick={() => setShowAddMenu(!showAddMenu)} variant="secondary" size="sm">
              + Add Item ▼
            </Button>
            {showAddMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 min-w-[200px]">
                <button
                  onClick={() => { onAddQuestion(round.id); setShowAddMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3 rounded-t-lg"
                >
                  <span>📝</span> Add Question
                </button>
                <div className="border-t border-slate-700">
                  <p className="px-4 py-2 text-xs text-slate-500 uppercase">Minigames</p>
                  <button
                    onClick={() => { onAddMinigame(round.id, "SWAN_RACE"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-3 pl-8 rounded-b-lg"
                  >
                    🦢 Swan Race
                  </button>
                </div>
              </div>
            )}
          </div>
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
          <p className="text-slate-400 text-center py-8">No questions in this round yet</p>
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
                    onEditSettings={onEditSettings}
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
  onEditSettings,
  getDifficultyLabel,
}: {
  item: QuizItem;
  itemIndex: number;
  roundId: string;
  onRemove: (roundId: string, itemId: string) => void;
  onEditSettings: (roundId: string, item: QuizItem) => void;
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

  // Get timer and points from settings
  const settings = item.settingsJson as { timer?: number; points?: number } | null;
  const timer = settings?.timer || 4;
  const points = settings?.points || 10;

  // Render content based on item type
  const renderItemContent = () => {
    if (item.itemType === "SCOREBOARD") {
      const settings = item.settingsJson as { displayType?: string } | null;
      const displayType = settings?.displayType || "TOP_10";
      const displayLabels: Record<string, string> = {
        TOP_3: "Top 3",
        TOP_5: "Top 5", 
        TOP_10: "Top 10",
        ALL: "All Players"
      };
      return (
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Scoreboard: {displayLabels[displayType] || displayType}
          </h3>
          <div className="text-sm text-slate-400 mt-1">
            Shows current standings to players
          </div>
        </div>
      );
    }
    
    if (item.itemType === "MINIGAME") {
      const minigameLabels: Record<string, { icon: string; name: string }> = {
        SWAN_RACE: { icon: "🦢", name: "Swan Race" },
      };
      const minigame = minigameLabels[item.minigameType || ""] || { icon: "🎮", name: item.minigameType || "Unknown" };
      return (
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-2xl">{minigame.icon}</span>
            Minigame: {minigame.name}
          </h3>
          <div className="text-sm text-slate-400 mt-1">
            Interactive minigame for all players
          </div>
        </div>
      );
    }
    
    if (item.itemType === "BREAK") {
      return (
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-2xl">☕</span>
            Break
          </h3>
          <div className="text-sm text-slate-400 mt-1">
            Pause in the quiz
          </div>
        </div>
      );
    }
    
    // Default: QUESTION type
    return (
      <div className="flex-1">
        <h3 className="font-semibold">{item.question?.title}</h3>
        <div className="flex gap-4 text-sm text-slate-400 mt-1">
          <span>{item.question?.type.replace(/_/g, " ")}</span>
          <span>{getDifficultyLabel(item.question?.difficulty || 3)}</span>
          <span>{item.question?.options.length || 0} options</span>
          {item.question?.media && item.question.media.length > 0 && (
            <span>📎 Has media</span>
          )}
          <span className="text-blue-400">⏱️ {timer}s</span>
          <span className="text-yellow-400">⭐ {points}pts</span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-600 rounded"
        aria-label="Drag to reorder item"
      >
        <svg
          className="w-4 h-4 text-slate-500"
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
      <span className="text-slate-400 font-mono w-8">{itemIndex + 1}.</span>
      {renderItemContent()}
      {/* Edit settings button - only for questions */}
      {item.itemType === "QUESTION" && (
        <Button
          onClick={() => onEditSettings(roundId, item)}
          variant="secondary"
          size="sm"
          title="Edit timer and points"
        >
          ⚙️
        </Button>
      )}
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
  const [startingSession, setStartingSession] = useState(false);
  
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  
  // Scoring settings
  const [editBasePoints, setEditBasePoints] = useState(10);
  const [editTimeBonusEnabled, setEditTimeBonusEnabled] = useState(true);
  const [editTimeBonusPercentage, setEditTimeBonusPercentage] = useState(50);
  const [editStreakBonusEnabled, setEditStreakBonusEnabled] = useState(true);
  const [editStreakBonusPoints, setEditStreakBonusPoints] = useState(1);

  // Add round
  const [showAddRound, setShowAddRound] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState("");

  // Add question to round
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);

  // Edit item settings
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ roundId: string; item: QuizItem } | null>(null);
  const [editTimer, setEditTimer] = useState(4);
  const [editPoints, setEditPoints] = useState(10);
  const [editShowExplanation, setEditShowExplanation] = useState(false);

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
      
      // Load scoring settings
      const scoringSettings = loadedQuiz.scoringSettingsJson as ScoringSettings | null;
      setEditBasePoints(scoringSettings?.basePoints ?? 10);
      setEditTimeBonusEnabled(scoringSettings?.timeBonusEnabled ?? true);
      setEditTimeBonusPercentage(scoringSettings?.timeBonusPercentage ?? 50);
      setEditStreakBonusEnabled(scoringSettings?.streakBonusEnabled ?? true);
      setEditStreakBonusPoints(scoringSettings?.streakBonusPoints ?? 1);
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
          scoringSettingsJson: {
            basePoints: editBasePoints,
            timeBonusEnabled: editTimeBonusEnabled,
            timeBonusPercentage: editTimeBonusPercentage,
            streakBonusEnabled: editStreakBonusEnabled,
            streakBonusPoints: editStreakBonusPoints,
          },
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

  const handleAddMinigame = async (roundId: string, minigameType: string = "SWAN_RACE") => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/${roundId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            itemType: "MINIGAME",
            minigameType,
            settingsJson: { duration: 60 }
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to add minigame");
      await loadQuiz();
    } catch (error) {
      console.error("Failed to add minigame:", error);
      alert("Failed to add minigame");
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

  const handleEditSettings = (roundId: string, item: QuizItem) => {
    const settings = item.settingsJson as { timer?: number; points?: number; showExplanation?: boolean } | null;
    setEditingItem({ roundId, item });
    setEditTimer(settings?.timer || 4);
    setEditPoints(settings?.points || 10);
    setEditShowExplanation(settings?.showExplanation ?? false);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!editingItem) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/rounds/${editingItem.roundId}/items`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: editingItem.item.id,
            settingsJson: {
              timer: editTimer,
              points: editPoints,
              showExplanation: editShowExplanation,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update settings");

      setShowSettingsModal(false);
      setEditingItem(null);
      await loadQuiz();
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("Failed to update settings");
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

  const handleStartSession = async () => {
    const totalQuestions = quiz?.rounds.reduce((sum, round) => sum + round.items.length, 0) || 0;
    
    if (totalQuestions === 0) {
      alert("Add at least one question to the quiz before starting a session.");
      return;
    }

    setStartingSession(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/quizzes/${quizId}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start session");
      }

      const { session, hostUrl } = await response.json();
      
      // Navigate to host page
      router.push(hostUrl);
    } catch (error) {
      console.error("Failed to start session:", error);
      alert(error instanceof Error ? error.message : "Failed to start session");
    } finally {
      setStartingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-slate-400">Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-slate-400">Quiz not found</p>
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
                <Button 
                  onClick={handleStartSession} 
                  disabled={startingSession || totalQuestions === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {startingSession ? "Starting..." : "🎮 Start Session"}
                </Button>
                {quiz._count.sessions > 0 && (
                  <Button 
                    onClick={() => router.push(`/workspaces/${workspaceId}/sessions?quizId=${quizId}`)}
                    variant="secondary"
                  >
                    📊 View Sessions ({quiz._count.sessions})
                  </Button>
                )}
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
                  className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              
              {/* Scoring Settings */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">⚙️ Scoring Instellingen</h3>
                
                {/* Base Points */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2">
                    Basis punten per vraag
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={editBasePoints}
                    onChange={(e) => setEditBasePoints(parseInt(e.target.value) || 10)}
                    className="w-32"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Standaard punten voor een 100% correct antwoord
                  </p>
                </div>

                {/* Time Bonus */}
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⏱️</span>
                      <div>
                        <label className="font-semibold">Snelheidsbonus</label>
                        <p className="text-xs text-slate-400">Extra punten voor snelle antwoorden</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTimeBonusEnabled}
                        onChange={(e) => setEditTimeBonusEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  {editTimeBonusEnabled && (
                    <div className="flex items-center gap-3 mt-3">
                      <label className="text-sm text-slate-400">Max bonus:</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editTimeBonusPercentage}
                        onChange={(e) => setEditTimeBonusPercentage(parseInt(e.target.value) || 50)}
                        className="w-20"
                      />
                      <span className="text-sm text-slate-400">%</span>
                      <span className="text-xs text-slate-500 ml-2">
                        (= max {Math.round((editTimeBonusPercentage / 100) * editBasePoints)} extra punten)
                      </span>
                    </div>
                  )}
                </div>

                {/* Streak Bonus */}
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔥</span>
                      <div>
                        <label className="font-semibold">Streak bonus</label>
                        <p className="text-xs text-slate-400">Extra punten voor achtereenvolgende goede antwoorden</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editStreakBonusEnabled}
                        onChange={(e) => setEditStreakBonusEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  {editStreakBonusEnabled && (
                    <div className="flex items-center gap-3 mt-3">
                      <label className="text-sm text-slate-400">Punten per streak:</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editStreakBonusPoints}
                        onChange={(e) => setEditStreakBonusPoints(parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="text-xs text-slate-500">
                        (bijv. 3 goede = +{editStreakBonusPoints * 3} pts)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
            {quiz.description && <p className="text-slate-400 mb-4">{quiz.description}</p>}
            <div className="flex gap-6 text-sm text-slate-400">
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
                onAddMinigame={handleAddMinigame}
                onRemoveItem={handleRemoveItem}
                onEditSettings={handleEditSettings}
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
              <p className="text-center text-slate-400 py-8">
                No questions available. Create some questions first!
              </p>
            ) : (
              <div className="space-y-3">
                {availableQuestions.map((question) => (
                  <div
                    key={question.id}
                    onClick={() => handleSelectQuestion(question.id)}
                    className="p-4 border border-slate-700 rounded-lg hover:bg-slate-800/50 cursor-pointer"
                  >
                    <h3 className="font-semibold mb-1">{question.title}</h3>
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span>{question.type.replace(/_/g, " ")}</span>
                      <span>{getDifficultyLabel(question.difficulty)}</span>
                      <span>{question.options?.length || 0} options</span>
                      {(question.media?.length || 0) > 0 && <span>📎 Has media</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="font-bold text-xl mb-4">Question Settings</h3>
            <p className="text-slate-400 mb-6">{editingItem.item.question?.title}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ⏱️ Timer Duration (seconds)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={editTimer}
                    onChange={(e) => setEditTimer(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="font-mono w-12 text-right text-lg">{editTimer}s</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">How long players have to answer</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  ⭐ Base Points
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 30, 40, 50].map((pts) => (
                    <button
                      key={pts}
                      onClick={() => setEditPoints(pts)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        editPoints === pts
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      {pts}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Points for correct answers (with time bonus)</p>
              </div>

              {/* Show Explanation Toggle */}
              {editingItem?.item.question?.explanation && (
                <div className="pt-4 border-t border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editShowExplanation}
                      onChange={(e) => setEditShowExplanation(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium">💡 Show Explanation After Reveal</span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Display the answer explanation on screen after revealing the correct answer
                      </p>
                    </div>
                  </label>
                  <div className="mt-2 p-3 bg-slate-700/50 rounded-lg text-sm text-slate-300">
                    <strong>Explanation:</strong> {editingItem.item.question.explanation}
                  </div>
                </div>
              )}
              {editingItem?.item.question && !editingItem.item.question.explanation && (
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    💡 No explanation set for this question. 
                    <a 
                      href={`/dashboard/workspaces/${workspaceId}/questions/${editingItem.item.question.id}/edit`}
                      className="text-blue-400 hover:underline ml-1"
                    >
                      Add one in the question editor
                    </a>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveSettings} className="flex-1">
                Save Settings
              </Button>
              <Button
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingItem(null);
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
