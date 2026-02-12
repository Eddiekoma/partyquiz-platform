"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { SpotifyTrackSelector } from "@/components/SpotifyTrackSelector";
import { FileUploader } from "@/components/media/FileUploader";
import { ScoringInfoCard } from "@/components/ScoringInfoCard";

interface QuestionSet {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
}

// Question types - matches the QuestionType enum in @partyquiz/shared
type QuestionTypeValue =
  | "MC_SINGLE"
  | "MC_MULTIPLE"
  | "TRUE_FALSE"
  | "OPEN_TEXT"
  | "ESTIMATION"
  | "ORDER"
  | "POLL"
  | "PHOTO_QUESTION"
  | "PHOTO_OPEN"
  | "AUDIO_QUESTION"
  | "AUDIO_OPEN"
  | "VIDEO_QUESTION"
  | "VIDEO_OPEN"
  | "MUSIC_GUESS_TITLE"
  | "MUSIC_GUESS_ARTIST"
  | "MUSIC_GUESS_YEAR"
  | "YOUTUBE_SCENE_QUESTION"
  | "YOUTUBE_NEXT_LINE"
  | "YOUTUBE_WHO_SAID_IT";

const QUESTION_TYPES: { value: QuestionTypeValue; label: string; description: string }[] = [
  { value: "MC_SINGLE", label: "Multiple Choice (Single)", description: "Choose one correct answer" },
  { value: "MC_MULTIPLE", label: "Multiple Choice (Multiple)", description: "Choose multiple correct answers" },
  { value: "TRUE_FALSE", label: "True/False", description: "Simple true or false question" },
  { value: "OPEN_TEXT", label: "Open Text", description: "Free text answer" },
  { value: "ESTIMATION", label: "Estimation", description: "Guess a number (Swan Race compatible)" },
  { value: "ORDER", label: "Order", description: "Put items in correct order" },
  { value: "PHOTO_QUESTION", label: "Photo Question", description: "Question with image" },
  { value: "AUDIO_QUESTION", label: "Audio Question", description: "Question with audio" },
  { value: "VIDEO_QUESTION", label: "Video Question", description: "Question with video" },
  { value: "MUSIC_GUESS_TITLE", label: "Music: Guess Title", description: "Guess song title from Spotify preview" },
  { value: "MUSIC_GUESS_ARTIST", label: "Music: Guess Artist", description: "Guess artist from Spotify preview" },
  { value: "MUSIC_GUESS_YEAR", label: "Music: Guess Year", description: "Guess release year from Spotify preview" },
  { value: "YOUTUBE_SCENE_QUESTION", label: "YouTube Scene Question", description: "Question about a YouTube video scene" },
  { value: "YOUTUBE_NEXT_LINE", label: "YouTube Next Line", description: "Guess the next line in a YouTube video" },
  { value: "YOUTUBE_WHO_SAID_IT", label: "YouTube Who Said It", description: "Identify who said what in a YouTube video" },
  { value: "POLL", label: "Poll", description: "No correct answer, just opinions" },
  { value: "PHOTO_OPEN", label: "Photo Open", description: "Open answer with photo" },
  { value: "AUDIO_OPEN", label: "Audio Open", description: "Open answer with audio" },
  { value: "VIDEO_OPEN", label: "Video Open", description: "Open answer with video" },
];

// Categorized question types
type CategoryKey = "text" | "photo" | "audio" | "video" | "spotify" | "youtube";

interface Category {
  key: CategoryKey;
  label: string;
  icon: string;
  description: string;
  types: QuestionTypeValue[];
}

const QUESTION_CATEGORIES: Category[] = [
  {
    key: "text",
    label: "Text Questions",
    icon: "📝",
    description: "Basic questions without media",
    types: ["MC_SINGLE", "MC_MULTIPLE", "TRUE_FALSE", "OPEN_TEXT", "ESTIMATION", "ORDER", "POLL"],
  },
  {
    key: "photo",
    label: "Photo Questions",
    icon: "📷",
    description: "Questions with uploaded images",
    types: ["PHOTO_QUESTION", "PHOTO_OPEN"],
  },
  {
    key: "audio",
    label: "Audio Questions",
    icon: "🎵",
    description: "Questions with uploaded audio files",
    types: ["AUDIO_QUESTION", "AUDIO_OPEN"],
  },
  {
    key: "video",
    label: "Video Questions",
    icon: "🎬",
    description: "Questions with uploaded video files",
    types: ["VIDEO_QUESTION", "VIDEO_OPEN"],
  },
  {
    key: "spotify",
    label: "Spotify Music",
    icon: "🎧",
    description: "Music questions using Spotify",
    types: ["MUSIC_GUESS_TITLE", "MUSIC_GUESS_ARTIST", "MUSIC_GUESS_YEAR"],
  },
  {
    key: "youtube",
    label: "YouTube Videos",
    icon: "▶️",
    description: "Questions using YouTube videos",
    types: ["YOUTUBE_SCENE_QUESTION", "YOUTUBE_NEXT_LINE", "YOUTUBE_WHO_SAID_IT"],
  },
];

export default function NewQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.id as string;
  const preselectedSetId = searchParams.get("setId");

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<QuestionTypeValue | null>(null);
  const [loading, setLoading] = useState(false);

  // Question Sets
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>(preselectedSetId || "");
  const [loadingSets, setLoadingSets] = useState(true);

  // Basic fields
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Fetch question sets on mount
  useEffect(() => {
    const fetchQuestionSets = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/question-sets`);
        if (response.ok) {
          const data = await response.json();
          setQuestionSets(data.questionSets || []);
          // Set preselected set if provided via URL
          if (preselectedSetId && data.questionSets.some((s: QuestionSet) => s.id === preselectedSetId)) {
            setSelectedSetId(preselectedSetId);
          }
        }
      } catch (error) {
        console.error("Failed to fetch question sets:", error);
      } finally {
        setLoadingSets(false);
      }
    };

    fetchQuestionSets();
  }, [workspaceId, preselectedSetId]);

  // MC_SINGLE / MC_MULTIPLE / POLL fields
  const [options, setOptions] = useState<Array<{ text: string; isCorrect: boolean; order: number }>>([
    { text: "", isCorrect: false, order: 0 },
    { text: "", isCorrect: false, order: 1 },
    { text: "", isCorrect: false, order: 2 },
    { text: "", isCorrect: false, order: 3 },
  ]);

  // TRUE_FALSE fields
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean>(true);

  // ESTIMATION fields
  const [estimationAnswer, setEstimationAnswer] = useState<number>(0);
  const [estimationMargin, setEstimationMargin] = useState<number>(10);

  // ORDER fields
  const [orderItems, setOrderItems] = useState<Array<{ text: string; correctOrder: number }>>([
    { text: "", correctOrder: 0 },
    { text: "", correctOrder: 1 },
    { text: "", correctOrder: 2 },
  ]);

  // OPEN_TEXT fields
  const [openTextAnswer, setOpenTextAnswer] = useState("");
  // Alternative acceptable answers for fuzzy matching
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>([]);
  const [acceptableAnswerInput, setAcceptableAnswerInput] = useState("");

  // Media upload
  const [uploadedAsset, setUploadedAsset] = useState<{
    id: string;
    filename: string;
    storageKey: string;
    url: string;
    type: string;
  } | null>(null);

  // Spotify/YouTube
  const [spotifyTrackId, setSpotifyTrackId] = useState<string>("");
  const [spotifyTrack, setSpotifyTrack] = useState<any>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [youtubeVideoId, setYoutubeVideoId] = useState<string>("");
  const [youtubeValidating, setYoutubeValidating] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeMetadata, setYoutubeMetadata] = useState<any>(null);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleValidateYouTubeUrl = async () => {
    if (!youtubeUrl.trim()) {
      setYoutubeError("Please enter a YouTube URL");
      return;
    }

    setYoutubeValidating(true);
    setYoutubeError(null);
    setYoutubeMetadata(null);
    setYoutubeVideoId("");

    try {
      const response = await fetch("/api/youtube/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to validate YouTube URL");
      }

      const data = await response.json();
      setYoutubeVideoId(data.videoId);
      setYoutubeMetadata({
        title: data.title,
        channelName: data.channelName,
        thumbnail: data.thumbnail,
      });
    } catch (error) {
      console.error("YouTube validation error:", error);
      setYoutubeError(error instanceof Error ? error.message : "Invalid YouTube URL");
    } finally {
      setYoutubeValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !title.trim()) {
      alert("Please select a question type and enter an internal name");
      return;
    }

    if (!prompt.trim()) {
      alert("Please enter the question text - this is what players will see");
      return;
    }

    // Validate YouTube URL for YouTube question types
    if (
      (selectedType === "YOUTUBE_SCENE_QUESTION" ||
        selectedType === "YOUTUBE_NEXT_LINE" ||
        selectedType === "YOUTUBE_WHO_SAID_IT") &&
      !youtubeVideoId
    ) {
      alert("Please validate a YouTube URL before creating the question");
      return;
    }

    // Validate correct answer for open text types (required for fuzzy matching)
    if (
      (selectedType === "OPEN_TEXT" ||
        selectedType === "PHOTO_OPEN" ||
        selectedType === "AUDIO_OPEN" ||
        selectedType === "VIDEO_OPEN") &&
      !openTextAnswer.trim()
    ) {
      alert("Please enter the correct answer - this is required for automatic scoring with fuzzy matching");
      return;
    }

    // Validate ESTIMATION fields - correctAnswer must be > 0 and margin must be >= 0
    if (selectedType === "ESTIMATION") {
      if (!estimationAnswer || estimationAnswer <= 0) {
        alert("Please enter a correct answer greater than 0 for estimation questions");
        return;
      }
      if (estimationMargin === undefined || estimationMargin < 0) {
        alert("Please enter a valid margin percentage (0 or higher) for estimation questions");
        return;
      }
    }

    setLoading(true);

    try {
      // Build question payload based on type
      let questionOptions: Array<{ text: string; isCorrect: boolean; order: number }> | undefined;

      switch (selectedType) {
        case "MC_SINGLE":
        case "MC_MULTIPLE":
          questionOptions = options.filter(opt => opt.text.trim() !== "");
          break;
        case "TRUE_FALSE":
          questionOptions = [
            { text: "True", isCorrect: trueFalseAnswer === true, order: 0 },
            { text: "False", isCorrect: trueFalseAnswer === false, order: 1 },
          ];
          break;
        case "POLL":
          questionOptions = options.filter(opt => opt.text.trim() !== "").map(opt => ({
            ...opt,
            isCorrect: false, // Polls have no correct answer
          }));
          break;
        case "ORDER":
          questionOptions = orderItems
            .filter(item => item.text.trim() !== "")
            .map(item => ({
              text: item.text,
              isCorrect: true,
              order: item.correctOrder,
            }));
          break;
        case "ESTIMATION":
          // Store correctAnswer in text field, margin in order field
          questionOptions = [
            { 
              text: String(estimationAnswer), 
              isCorrect: true, 
              order: estimationMargin 
            }
          ];
          break;
        case "OPEN_TEXT":
        case "PHOTO_OPEN":
        case "AUDIO_OPEN":
        case "VIDEO_OPEN":
          if (openTextAnswer.trim()) {
            // Primary correct answer
            questionOptions = [{ text: openTextAnswer, isCorrect: true, order: 0 }];
            // Add acceptable alternative answers (order 1, 2, 3, etc.)
            const validAlternatives = acceptableAnswers.filter(a => a.trim() !== "");
            validAlternatives.forEach((alt, index) => {
              questionOptions!.push({ text: alt.trim(), isCorrect: true, order: index + 1 });
            });
          }
          break;
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          prompt: prompt || undefined,
          explanation: explanation || undefined,
          difficulty,
          tags,
          status: "DRAFT",
          questionSetId: selectedSetId || undefined,
          options: questionOptions,
          spotifyTrackId: spotifyTrackId || undefined,
          youtubeVideoId: youtubeVideoId || undefined,
          mediaUrl: uploadedAsset?.storageKey || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create question");
      }

      // Redirect back to the set detail page if a set was selected, otherwise to questions overview
      if (selectedSetId) {
        router.push(`/dashboard/workspaces/${workspaceId}/questions/sets/${selectedSetId}`);
      } else {
        router.push(`/dashboard/workspaces/${workspaceId}/questions`);
      }
    } catch (error) {
      console.error("Failed to create question:", error);
      alert(error instanceof Error ? error.message : "Failed to create question");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedType) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Create Question</h1>
          <p className="text-slate-400">
            {selectedCategory 
              ? `Choose a question type from ${QUESTION_CATEGORIES.find(c => c.key === selectedCategory)?.label}`
              : "Choose a category to get started"}
          </p>
        </div>

        {!selectedCategory ? (
          /* Category Selection */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUESTION_CATEGORIES.map((category) => (
              <div key={category.key} onClick={() => setSelectedCategory(category.key)}>
                <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 hover:scale-[1.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{category.icon}</span>
                    <h3 className="text-lg font-semibold">{category.label}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{category.description}</p>
                  <p className="text-xs text-slate-500 mt-2">{category.types.length} type(s)</p>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          /* Question Type Selection within Category */
          <div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-primary-600 hover:text-primary-700 mb-4"
            >
              ← Back to Categories
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {QUESTION_TYPES
                .filter((type) => {
                  const category = QUESTION_CATEGORIES.find(c => c.key === selectedCategory);
                  return category?.types.includes(type.value);
                })
                .map((type) => (
                  <div key={type.value} onClick={() => setSelectedType(type.value)}>
                    <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 hover:scale-[1.02]">
                      <h3 className="text-lg font-semibold mb-2">{type.label}</h3>
                      <p className="text-sm text-slate-400">{type.description}</p>
                    </Card>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => {
            setSelectedType(null);
            setSelectedCategory(null);
          }}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Change Question Type
        </button>
        <h1 className="text-3xl font-bold mb-2">
          {QUESTION_TYPES.find((t) => t.value === selectedType)?.label}
        </h1>
        <p className="text-slate-400">
          {QUESTION_TYPES.find((t) => t.value === selectedType)?.description}
        </p>
      </div>

      {/* Scoring Info */}
      {selectedType && (
        <div className="mb-6">
          <ScoringInfoCard questionType={selectedType} />
        </div>
      )}

      <div className="space-y-6">
        {/* Question Set Selection */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Question Set
          </label>
          <select
            value={selectedSetId}
            onChange={(e) => setSelectedSetId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-800 text-white"
          >
            <option value="">Select a question set...</option>
            {questionSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.questionCount} questions)
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Choose which set this question belongs to</p>
        </Card>

        {/* Title - Internal Name */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Internal Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short name for question bank (e.g., 'Mona Lisa painting')"
            className="w-full"
          />
          <p className="text-xs text-slate-400 mt-1">Used to identify this question in the question bank</p>
        </Card>

        {/* Question Text (was Prompt) */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Question Text <span className="text-red-500">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="The actual question shown to players (e.g., 'Which painting is the most famous in the world?')"
            className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-800 text-white"
            rows={3}
          />
          <p className="text-xs text-slate-400 mt-1">This is what players will see during the quiz</p>
        </Card>

        {/* Type-Specific Fields */}
        {(selectedType === "MC_SINGLE" || selectedType === "MC_MULTIPLE") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Answer Options</label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex gap-3 items-center">
                  {selectedType === "MC_SINGLE" ? (
                    <input
                      type="radio"
                      checked={option.isCorrect}
                      onChange={() => {
                        const newOptions = options.map((opt, i) => ({
                          ...opt,
                          isCorrect: i === index,
                        }));
                        setOptions(newOptions);
                      }}
                      className="w-5 h-5 text-primary-600"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[index] = { ...option, isCorrect: e.target.checked };
                        setOptions(newOptions);
                      }}
                      className="w-5 h-5 text-primary-600"
                    />
                  )}
                  <Input
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = { ...option, text: e.target.value };
                      setOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={() => setOptions([...options, { text: "", isCorrect: false, order: options.length }])}
              variant="secondary"
              className="mt-3"
            >
              + Add Option
            </Button>
          </Card>
        )}

        {selectedType === "TRUE_FALSE" && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Correct Answer</label>
            <div className="flex gap-4">
              <button
                onClick={() => setTrueFalseAnswer(true)}
                className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-colors ${
                  trueFalseAnswer
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-600 bg-white text-slate-300 hover:border-slate-500"
                }`}
              >
                ✅ True
              </button>
              <button
                onClick={() => setTrueFalseAnswer(false)}
                className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-colors ${
                  !trueFalseAnswer
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-600 bg-white text-slate-300 hover:border-slate-500"
                }`}
              >
                ❌ False
              </button>
            </div>
          </Card>
        )}

        {selectedType === "ESTIMATION" && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Correct Answer & Margin</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Correct Answer</label>
                <Input
                  type="number"
                  value={estimationAnswer}
                  onChange={(e) => setEstimationAnswer(parseFloat(e.target.value))}
                  placeholder="e.g., 42"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Margin (%)</label>
                <Input
                  type="number"
                  value={estimationMargin}
                  onChange={(e) => setEstimationMargin(parseFloat(e.target.value))}
                  placeholder="e.g., 10"
                />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Answers within {estimationMargin}% of {estimationAnswer} will be considered correct.
            </p>
          </Card>
        )}

        {/* ORDER */}
        {selectedType === "ORDER" && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              Items to Order (in correct order)
            </label>
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <span className="text-slate-400 font-mono w-8">{index + 1}.</span>
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...orderItems];
                      newItems[index] = { text: e.target.value, correctOrder: index };
                      setOrderItems(newItems);
                    }}
                    placeholder={`Item ${index + 1}`}
                    className="flex-1"
                  />
                  {orderItems.length > 2 && (
                    <button
                      onClick={() => {
                        const newItems = orderItems
                          .filter((_, i) => i !== index)
                          .map((item, i) => ({ ...item, correctOrder: i }));
                        setOrderItems(newItems);
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button
              onClick={() =>
                setOrderItems([...orderItems, { text: "", correctOrder: orderItems.length }])
              }
              variant="secondary"
              className="mt-3"
            >
              + Add Item
            </Button>
            <p className="text-sm text-slate-400 mt-2">
              Players will need to drag these items into the correct order
            </p>
          </Card>
        )}

        {/* POLL */}
        {selectedType === "POLL" && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              Poll Options (no correct answer)
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <span className="text-slate-500 text-2xl">📊</span>
                  <Input
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = { ...option, text: e.target.value };
                      setOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button
              onClick={() => setOptions([...options, { text: "", isCorrect: false, order: options.length }])}
              variant="secondary"
              className="mt-3"
            >
              + Add Option
            </Button>
          </Card>
        )}

        {/* OPEN_TEXT and *_OPEN types */}
        {(selectedType === "OPEN_TEXT" ||
          selectedType === "PHOTO_OPEN" ||
          selectedType === "AUDIO_OPEN" ||
          selectedType === "VIDEO_OPEN") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-2">
              Correct Answer <span className="text-red-400">*</span>
            </label>
            <textarea
              value={openTextAnswer}
              onChange={(e) => setOpenTextAnswer(e.target.value)}
              placeholder="Enter the correct answer..."
              className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              required
            />
            <p className="text-sm text-slate-400 mt-2">
              <strong>Fuzzy matching:</strong> Player answers with 85%+ similarity are accepted. Small typos are allowed.
            </p>
            
            {/* Acceptable Alternative Answers */}
            <div className="mt-6 pt-4 border-t border-slate-600">
              <label className="block text-sm font-semibold mb-2">
                Alternative Correct Answers (Optional)
              </label>
              <p className="text-sm text-slate-400 mb-3">
                Add alternative answers that should also be accepted. Each answer uses the same fuzzy matching.
              </p>
              
              {acceptableAnswers.map((answer, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...acceptableAnswers];
                      newAnswers[index] = e.target.value;
                      setAcceptableAnswers(newAnswers);
                    }}
                    placeholder={`Alternative answer ${index + 1}...`}
                    className="flex-1 px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newAnswers = acceptableAnswers.filter((_, i) => i !== index);
                      setAcceptableAnswers(newAnswers);
                    }}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => setAcceptableAnswers([...acceptableAnswers, ""])}
                className="mt-2 px-4 py-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors text-sm"
              >
                + Add Alternative Answer
              </button>
            </div>
          </Card>
        )}

        {/* Media upload for PHOTO/AUDIO/VIDEO types */}
        {(selectedType === "PHOTO_QUESTION" ||
          selectedType === "AUDIO_QUESTION" ||
          selectedType === "VIDEO_QUESTION" ||
          selectedType === "PHOTO_OPEN" ||
          selectedType === "AUDIO_OPEN" ||
          selectedType === "VIDEO_OPEN") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              Media Attachment
            </label>
            
            {!uploadedAsset ? (
              <FileUploader
                workspaceId={workspaceId}
                category={
                  selectedType.startsWith("PHOTO") ? "images" :
                  selectedType.startsWith("AUDIO") ? "audio" : "video"
                }
                accept={
                  selectedType.startsWith("PHOTO") ? "image/*" :
                  selectedType.startsWith("AUDIO") ? "audio/*" : "video/*"
                }
                maxSize={selectedType.startsWith("VIDEO") ? 50 : 10}
                onUploadComplete={(asset) => {
                  setUploadedAsset(asset);
                }}
                onError={(error) => {
                  alert(`Upload failed: ${error}`);
                }}
              />
            ) : (
              <div className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {selectedType.startsWith("PHOTO") && (
                    <img 
                      src={uploadedAsset.url} 
                      alt={uploadedAsset.filename}
                      className="w-32 h-32 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{uploadedAsset.filename}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {selectedType.startsWith("PHOTO") ? "Image" :
                       selectedType.startsWith("AUDIO") ? "Audio" : "Video"} uploaded successfully
                    </p>
                    <button
                      onClick={() => setUploadedAsset(null)}
                      className="text-sm text-red-600 hover:text-red-700 mt-2"
                    >
                      Remove and upload different file
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Spotify Integration for MUSIC types */}
        {(selectedType === "MUSIC_GUESS_TITLE" || 
          selectedType === "MUSIC_GUESS_ARTIST" || 
          selectedType === "MUSIC_GUESS_YEAR") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">🎵 Spotify Track Selection</label>
            <SpotifyTrackSelector
              selectedTrack={spotifyTrack}
              onSelect={(track) => {
                setSpotifyTrack(track);
                setSpotifyTrackId(track.id);
              }}
            />
          </Card>
        )}

        {/* YouTube Integration for YOUTUBE types */}
        {(selectedType === "YOUTUBE_SCENE_QUESTION" ||
          selectedType === "YOUTUBE_NEXT_LINE" ||
          selectedType === "YOUTUBE_WHO_SAID_IT") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              🎬 YouTube Video
            </label>
            <p className="text-sm text-slate-400 mb-4">
              Enter a YouTube URL to attach a video clip to this question.
              You can specify which segment of the video to show.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  YouTube URL *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setYoutubeError(null);
                    }}
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    disabled={youtubeValidating}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleValidateYouTubeUrl}
                    disabled={!youtubeUrl.trim() || youtubeValidating}
                  >
                    {youtubeValidating ? "Validating..." : youtubeMetadata ? "✓ Valid" : "Validate"}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Paste any YouTube URL (watch, youtu.be, embed format)
                </p>
                {youtubeError && (
                  <p className="text-sm text-red-600 mt-2">
                    ❌ {youtubeError}
                  </p>
                )}
              </div>

              {/* YouTube Preview */}
              {youtubeMetadata && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex gap-4">
                    {youtubeMetadata.thumbnail && (
                      <img
                        src={youtubeMetadata.thumbnail}
                        alt={youtubeMetadata.title}
                        className="w-32 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{youtubeMetadata.title}</p>
                      <p className="text-sm text-slate-400 mt-1">{youtubeMetadata.channelName}</p>
                      <p className="text-xs text-green-700 mt-2">✓ Video validated successfully</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> After creating the question, you can edit it to set
                the exact start/end timestamps for the video segment.
              </p>
            </div>
          </Card>
        )}

        {/* Explanation */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">Explanation (optional)</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain the answer..."
            className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </Card>

        {/* Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Settings</h3>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="1">Very Easy</option>
                <option value="2">Easy</option>
                <option value="3">Medium</option>
                <option value="4">Hard</option>
                <option value="5">Very Hard</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Tags</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1"
              />
              <Button onClick={handleAddTag} variant="secondary">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm flex items-center gap-2"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => router.back()}
            variant="secondary"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Create Question
          </Button>
        </div>
      </div>
    </div>
  );
}
