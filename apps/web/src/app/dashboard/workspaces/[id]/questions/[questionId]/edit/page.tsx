"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { UploadZone } from "@/components/ui/Upload";
import { parseTimestamp, formatTimestamp, QuestionType, normalizeQuestionType } from "@partyquiz/shared";
import { ScoringInfoCard } from "@/components/ScoringInfoCard";

interface QuestionOption {
  id?: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionMedia {
  id: string;
  provider: string;
  mediaType: string;
  reference: any;
  metadata?: any;
  order: number;
}

export default function EditQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const questionId = params.questionId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<QuestionType | null>(null);

  // Basic fields
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // MC_SINGLE / MC_MULTIPLE / POLL fields
  const [options, setOptions] = useState<QuestionOption[]>([
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
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>([]);

  // Media
  const [media, setMedia] = useState<QuestionMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Spotify/YouTube
  const [spotifyTrackId, setSpotifyTrackId] = useState<string | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeStartTime, setYoutubeStartTime] = useState<string>("0:00");
  const [youtubeEndTime, setYoutubeEndTime] = useState<string>("");

  useEffect(() => {
    loadQuestion();
  }, [questionId]);

  const loadQuestion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/questions/${questionId}`);
      if (!response.ok) throw new Error("Failed to load question");

      const { question } = await response.json();
      
      setSelectedType(question.type);
      setTitle(question.title || "");
      setPrompt(question.prompt || "");
      setExplanation(question.explanation || "");
      setDifficulty(question.difficulty || 3);
      setStatus(question.status || "DRAFT");
      
      // Parse tags
      const parsedTags = Array.isArray(question.tagsJson)
        ? question.tagsJson
        : typeof question.tagsJson === "string"
        ? JSON.parse(question.tagsJson)
        : [];
      setTags(parsedTags);

      // Load options
      if (question.options && question.options.length > 0) {
        setOptions(question.options.sort((a: any, b: any) => a.order - b.order));
      }

      // Load TRUE_FALSE answer
      if (question.type === "TRUE_FALSE" && question.options) {
        const trueOption = question.options.find((opt: any) => opt.text === "True");
        setTrueFalseAnswer(trueOption?.isCorrect || true);
      }

      // Load ESTIMATION answer and margin from options
      if (question.type === "ESTIMATION" && question.options && question.options.length > 0) {
        const estOption = question.options[0];
        setEstimationAnswer(parseFloat(estOption.text) || 0);
        setEstimationMargin(estOption.order || 10);
      }

      // Load ORDER items from options
      if (question.type === "ORDER" && question.options && question.options.length > 0) {
        const sortedOptions = question.options
          .sort((a: any, b: any) => a.order - b.order)
          .map((opt: any) => ({
            text: opt.text,
            correctOrder: opt.order,
          }));
        setOrderItems(sortedOptions);
      }

      // Load OPEN_TEXT answer from options
      if (
        (question.type === "OPEN_TEXT" ||
          question.type === "PHOTO_OPEN_TEXT" ||
          question.type === "AUDIO_OPEN" ||
          question.type === "VIDEO_OPEN") &&
        question.options &&
        question.options.length > 0
      ) {
        // Sort by order to get primary answer first
        const sortedOptions = [...question.options].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        const correctOptions = sortedOptions.filter((opt: any) => opt.isCorrect);
        
        if (correctOptions.length > 0) {
          // Primary correct answer (order 0 or lowest)
          setOpenTextAnswer(correctOptions[0].text || "");
          // Additional acceptable answers (remaining correct options)
          if (correctOptions.length > 1) {
            setAcceptableAnswers(correctOptions.slice(1).map((opt: any) => opt.text));
          }
        }
      }

      // Load media
      if (question.media) {
        setMedia(question.media);
      }

      setSpotifyTrackId(question.spotifyTrackId);
      setYoutubeVideoId(question.youtubeVideoId);
      
      // Load YouTube timestamps from settingsJson
      if (question.settingsJson) {
        const settings = typeof question.settingsJson === "string" 
          ? JSON.parse(question.settingsJson) 
          : question.settingsJson;
        
        if (settings.startSeconds !== undefined) {
          setYoutubeStartTime(formatTimestamp(settings.startSeconds));
        }
        if (settings.endSeconds !== undefined) {
          setYoutubeEndTime(formatTimestamp(settings.endSeconds));
        }
      }
    } catch (error) {
      console.error("Failed to load question:", error);
      alert("Failed to load question");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleMediaUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploadingMedia(true);
    try {
      // Upload first file
      const file = files[0];
      const uploadResponse = await fetch(`/api/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          mime: file.type,
          size: file.size,
        }),
      });

      if (!uploadResponse.ok) throw new Error("Failed to get upload URL");

      const { uploadUrl, asset } = await uploadResponse.json();

      // Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Determine media type
      const mediaType = file.type.startsWith("image/")
        ? "IMAGE"
        : file.type.startsWith("audio/")
        ? "AUDIO"
        : "VIDEO";

      // Attach media to question via API
      const attachResponse = await fetch(
        `/api/workspaces/${workspaceId}/questions/${questionId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "UPLOAD",
            mediaType,
            assetId: asset.id,
            order: media.length,
          }),
        }
      );

      if (!attachResponse.ok) throw new Error("Failed to attach media to question");

      const { media: attachedMedia } = await attachResponse.json();

      // Add to local state
      setMedia([...media, attachedMedia]);
      alert("Media uploaded and attached successfully!");
    } catch (error) {
      console.error("Failed to upload media:", error);
      alert("Failed to upload media");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMediaUploadResult = async (result: { assetId: string; publicUrl: string }) => {
    setUploadingMedia(true);
    try {
      // Determine media type from selected question type
      const mediaType = selectedType?.startsWith("PHOTO")
        ? "IMAGE"
        : selectedType?.startsWith("AUDIO")
        ? "AUDIO"
        : "VIDEO";

      // Attach media to question via API
      const attachResponse = await fetch(
        `/api/workspaces/${workspaceId}/questions/${questionId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "UPLOAD",
            mediaType,
            assetId: result.assetId,
            order: media.length,
          }),
        }
      );

      if (!attachResponse.ok) throw new Error("Failed to attach media to question");

      const { media: attachedMedia } = await attachResponse.json();

      // Add to local state
      setMedia([...media, attachedMedia]);
    } catch (error) {
      console.error("Failed to attach media:", error);
      alert("Failed to attach media to question");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = async (mediaId: string) => {
    if (!confirm("Remove this media from the question?")) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/questions/${questionId}/media?mediaId=${mediaId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to remove media");

      setMedia(media.filter((m) => m.id !== mediaId));
      alert("Media removed successfully!");
    } catch (error) {
      console.error("Failed to remove media:", error);
      alert("Failed to remove media");
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !title.trim()) {
      alert("Please enter an internal name");
      return;
    }

    if (!prompt.trim()) {
      alert("Please enter the question text - this is what players will see");
      return;
    }

    // Validate NUMERIC fields - correctAnswer must be > 0 and margin must be >= 0
    if (selectedType === QuestionType.NUMERIC) {
      if (!estimationAnswer || estimationAnswer <= 0) {
        alert("Please enter a correct answer greater than 0 for numeric estimation questions");
        return;
      }
      if (estimationMargin === undefined || estimationMargin < 0) {
        alert("Please enter a valid margin percentage (0 or higher) for numeric estimation questions");
        return;
      }
    }

    // Validate correct answer for open text types
    if (
      (selectedType === "OPEN_TEXT" ||
        selectedType === "PHOTO_OPEN_TEXT" ||
        selectedType === "AUDIO_OPEN" ||
        selectedType === "VIDEO_OPEN") &&
      !openTextAnswer.trim()
    ) {
      alert("Please enter the correct answer - this is required for automatic scoring with fuzzy matching");
      return;
    }

    setSaving(true);

    try {
      // Build question payload based on type
      let questionOptions: QuestionOption[] | undefined;

      switch (selectedType) {
        case QuestionType.MC_SINGLE:
        case QuestionType.MC_MULTIPLE:
          questionOptions = options.filter((opt) => opt.text.trim() !== "");
          break;
        case QuestionType.TRUE_FALSE:
          questionOptions = [
            { text: "True", isCorrect: trueFalseAnswer === true, order: 0 },
            { text: "False", isCorrect: trueFalseAnswer === false, order: 1 },
          ];
          break;
        case QuestionType.MC_ORDER:
          questionOptions = orderItems
            .filter((item) => item.text.trim() !== "")
            .map((item, index) => ({
              text: item.text,
              isCorrect: true, // All items are "correct" for MC_ORDER
              order: item.correctOrder,
            }));
          break;
        case QuestionType.NUMERIC:
          // Store correctAnswer in text field, margin in order field
          questionOptions = [
            { 
              text: String(estimationAnswer), 
              isCorrect: true, 
              order: estimationMargin 
            },
          ];
          break;
        case QuestionType.OPEN_TEXT:
        case QuestionType.PHOTO_OPEN_TEXT:
        case QuestionType.AUDIO_OPEN:
        case QuestionType.VIDEO_OPEN:
          // Store correct answer in options with isCorrect: true
          if (openTextAnswer.trim()) {
            // Primary correct answer
            questionOptions = [
              { text: openTextAnswer, isCorrect: true, order: 0 },
            ];
            // Add acceptable alternative answers (order 1, 2, 3, etc.)
            const validAlternatives = acceptableAnswers.filter(a => a.trim() !== "");
            validAlternatives.forEach((alt, index) => {
              questionOptions!.push({ text: alt.trim(), isCorrect: true, order: index + 1 });
            });
          }
          break;
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          prompt: prompt || undefined,
          explanation: explanation || undefined,
          difficulty,
          status,
          tags,
          options: questionOptions,
          spotifyTrackId: spotifyTrackId || undefined,
          youtubeVideoId: youtubeVideoId || undefined,
          settingsJson: 
            selectedType === "YOUTUBE_SCENE_QUESTION" ||
            selectedType === "YOUTUBE_NEXT_LINE" ||
            selectedType === "YOUTUBE_WHO_SAID_IT"
              ? {
                  startSeconds: parseTimestamp(youtubeStartTime),
                  endSeconds: youtubeEndTime ? parseTimestamp(youtubeEndTime) : undefined,
                }
              : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update question");
      }

      alert("Question updated successfully!");
      router.push(`/dashboard/workspaces/${workspaceId}/questions`);
    } catch (error) {
      console.error("Failed to update question:", error);
      alert(error instanceof Error ? error.message : "Failed to update question");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading question...</div>
      </div>
    );
  }

  if (!selectedType) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">Failed to load question</div>
      </div>
    );
  }

  const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    [QuestionType.MC_SINGLE]: "Multiple Choice (Single)",
    [QuestionType.MC_MULTIPLE]: "Multiple Choice (Multiple)",
    [QuestionType.MC_ORDER]: "Multiple Choice (Order)",
    [QuestionType.TRUE_FALSE]: "True/False",
    [QuestionType.OPEN_TEXT]: "Open Text",
    [QuestionType.NUMERIC]: "Numeric Estimation",
    [QuestionType.SLIDER]: "Slider",
    [QuestionType.PHOTO_MC_SINGLE]: "Photo MC (Single)",
    [QuestionType.PHOTO_MC_MULTIPLE]: "Photo MC (Multiple)",
    [QuestionType.PHOTO_MC_ORDER]: "Photo Order",
    [QuestionType.PHOTO_OPEN_TEXT]: "Photo Open Text",
    [QuestionType.PHOTO_NUMERIC]: "Photo Numeric",
    [QuestionType.PHOTO_SLIDER]: "Photo Slider",
    [QuestionType.PHOTO_TRUE_FALSE]: "Photo True/False",
    [QuestionType.AUDIO_QUESTION]: "Audio Question",
    [QuestionType.AUDIO_OPEN]: "Audio Open",
    [QuestionType.VIDEO_QUESTION]: "Video Question",
    [QuestionType.VIDEO_OPEN]: "Video Open",
    [QuestionType.MUSIC_GUESS_TITLE]: "Music - Guess Title",
    [QuestionType.MUSIC_GUESS_ARTIST]: "Music - Guess Artist",
    [QuestionType.MUSIC_GUESS_YEAR]: "Music - Guess Year",
    [QuestionType.YOUTUBE_SCENE_QUESTION]: "YouTube Scene Question",
    [QuestionType.YOUTUBE_NEXT_LINE]: "YouTube Next Line",
    [QuestionType.YOUTUBE_WHO_SAID_IT]: "YouTube Who Said It",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Edit Question</h1>
          <p className="text-slate-400">{QUESTION_TYPE_LABELS[selectedType]}</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/questions`)}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Scoring Info */}
      {selectedType && (
        <div className="mb-6">
          <ScoringInfoCard questionType={selectedType} />
        </div>
      )}

      <div className="space-y-6">
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

        {/* MC_SINGLE / MC_MULTIPLE */}
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
              onClick={() =>
                setOptions([...options, { text: "", isCorrect: false, order: options.length }])
              }
              variant="secondary"
              className="mt-3"
            >
              + Add Option
            </Button>
          </Card>
        )}

        {/* TRUE_FALSE */}
        {selectedType === "TRUE_FALSE" && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Correct Answer</label>
            <div className="flex gap-4">
              <button
                onClick={() => setTrueFalseAnswer(true)}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-colors ${
                  trueFalseAnswer
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                ✓ True
              </button>
              <button
                onClick={() => setTrueFalseAnswer(false)}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-colors ${
                  !trueFalseAnswer
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                ✗ False
              </button>
            </div>
          </Card>
        )}

        {/* NUMERIC ESTIMATION */}
        {selectedType === QuestionType.NUMERIC && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Numeric Estimation Settings</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Correct Answer</label>
                <Input
                  type="number"
                  value={estimationAnswer}
                  onChange={(e) => setEstimationAnswer(parseFloat(e.target.value))}
                  placeholder="Enter the correct number..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Margin (%)</label>
                <Input
                  type="number"
                  value={estimationMargin}
                  onChange={(e) => setEstimationMargin(parseFloat(e.target.value))}
                  min={0}
                  max={100}
                  placeholder="Acceptable margin of error..."
                />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Players within {estimationMargin}% of {estimationAnswer} get points (Swan Race compatible)
            </p>
          </Card>
        )}

        {/* MC_ORDER */}
        {selectedType === QuestionType.MC_ORDER && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              Items to Order (drag to reorder - correct order)
            </label>
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <span className="text-slate-400 font-mono w-8">{index + 1}.</span>
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...orderItems];
                      newItems[index] = { ...item, text: e.target.value };
                      setOrderItems(newItems);
                    }}
                    placeholder={`Item ${index + 1}`}
                    className="flex-1"
                  />
                  {orderItems.length > 2 && (
                    <button
                      onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
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
                setOrderItems([
                  ...orderItems,
                  { text: "", correctOrder: orderItems.length },
                ])
              }
              variant="secondary"
              className="mt-3"
            >
              + Add Item
            </Button>
          </Card>
        )}

        {/* Multiple Choice (Single or Multiple) */}
        {(selectedType === QuestionType.MC_SINGLE || selectedType === QuestionType.MC_MULTIPLE) && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Poll Options (no correct answer)</label>
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
              onClick={() =>
                setOptions([...options, { text: "", isCorrect: false, order: options.length }])
              }
              variant="secondary"
              className="mt-3"
            >
              + Add Option
            </Button>
          </Card>
        )}

        {/* OPEN_TEXT and *_OPEN types */}
        {(selectedType === "OPEN_TEXT" ||
          selectedType === "PHOTO_OPEN_TEXT" ||
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

        {/* Media Upload for PHOTO/AUDIO/VIDEO types */}
        {(selectedType === "PHOTO_MC_SINGLE" ||
          selectedType === "AUDIO_QUESTION" ||
          selectedType === "VIDEO_QUESTION" ||
          selectedType === "PHOTO_OPEN_TEXT" ||
          selectedType === "AUDIO_OPEN" ||
          selectedType === "VIDEO_OPEN") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Media Attachment</label>
            
            {/* Show existing media */}
            {media.length > 0 && (
              <div className="space-y-2 mb-4">
                {media.map((m) => (
                  <div key={m.id} className="p-3 bg-slate-800/50 rounded flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium">
                        {m.mediaType} media
                      </span>
                      <span className="text-xs text-slate-400 ml-2">({m.provider})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(m.id)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new media */}
            {media.length === 0 && (
              <UploadZone
                workspaceId={workspaceId}
                accept={
                  selectedType.startsWith("PHOTO")
                    ? "image/*"
                    : selectedType.startsWith("AUDIO")
                    ? "audio/*"
                    : "video/*"
                }
                onUploadComplete={handleMediaUploadResult}
                onUploadError={(error: string) => alert(`Upload failed: ${error}`)}
              />
            )}

            {media.length > 0 && (
              <p className="text-sm text-slate-400 mt-2">
                📎 Media is attached. Remove it to upload a different file.
              </p>
            )}
          </Card>
        )}

        {/* Spotify Integration for MUSIC types */}
        {(selectedType === QuestionType.MUSIC_GUESS_TITLE || 
          selectedType === QuestionType.MUSIC_GUESS_ARTIST || 
          selectedType === QuestionType.MUSIC_GUESS_YEAR) && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Spotify Track</label>
            <div className="space-y-3">
              <Input
                value={spotifyTrackId || ""}
                onChange={(e) => setSpotifyTrackId(e.target.value || null)}
                placeholder="Enter Spotify Track ID (e.g., 3n3Ppam7vgaVa1iaRUc9Lp)"
              />
              <p className="text-sm text-slate-400">
                You can find the Track ID in the Spotify share URL. Full Spotify integration coming soon!
              </p>
            </div>
          </Card>
        )}

        {/* YouTube Integration for YOUTUBE types */}
        {(selectedType === "YOUTUBE_SCENE_QUESTION" ||
          selectedType === "YOUTUBE_NEXT_LINE" ||
          selectedType === "YOUTUBE_WHO_SAID_IT") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">
              🎬 YouTube Video Segment
            </label>
            
            <div className="space-y-4">
              {/* Video ID Display */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Video ID</label>
                <Input
                  value={youtubeVideoId || ""}
                  disabled
                  className="bg-slate-800/50"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Video ID is set when creating the question. To change the video, create a new question.
                </p>
              </div>

              {/* Timestamp Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Start Time (MM:SS)
                  </label>
                  <Input
                    value={youtubeStartTime}
                    onChange={(e) => setYoutubeStartTime(e.target.value)}
                    placeholder="0:00"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    When to start playing (e.g., 1:30)
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    End Time (MM:SS) - Optional
                  </label>
                  <Input
                    value={youtubeEndTime}
                    onChange={(e) => setYoutubeEndTime(e.target.value)}
                    placeholder="Leave empty for no limit"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    When to stop playing (e.g., 1:45)
                  </p>
                </div>
              </div>

              {/* Preview Info */}
              {youtubeVideoId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    💡 <strong>Preview:</strong> Players will see the video segment from{" "}
                    <strong>{youtubeStartTime || "0:00"}</strong>
                    {youtubeEndTime && (
                      <>
                        {" "}to <strong>{youtubeEndTime}</strong>
                      </>
                    )}
                  </p>
                  <a
                    href={`https://www.youtube.com/watch?v=${youtubeVideoId}&t=${parseTimestamp(youtubeStartTime)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    🎥 Preview on YouTube →
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Explanation */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Explanation (shown after answer)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Optional: Explain the correct answer..."
            className="w-full px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </Card>

        {/* Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            <div>
              <label className="block text-sm text-slate-400 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
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
                    className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm flex items-center gap-2"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
