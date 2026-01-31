"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "MC_SINGLE", label: "Multiple Choice (Single)", description: "Choose one correct answer" },
  { value: "MC_MULTIPLE", label: "Multiple Choice (Multiple)", description: "Choose multiple correct answers" },
  { value: "TRUE_FALSE", label: "True/False", description: "Simple true or false question" },
  { value: "OPEN_TEXT", label: "Open Text", description: "Free text answer" },
  { value: "ESTIMATION", label: "Estimation", description: "Guess a number (Swan Race compatible)" },
  { value: "ORDER", label: "Order", description: "Put items in correct order" },
  { value: "PHOTO_QUESTION", label: "Photo Question", description: "Question with image" },
  { value: "AUDIO_QUESTION", label: "Audio Question", description: "Question with audio" },
  { value: "VIDEO_QUESTION", label: "Video Question", description: "Question with video" },
  { value: "MUSIC_INTRO", label: "Music Intro", description: "Guess song from intro" },
  { value: "MUSIC_SNIPPET", label: "Music Snippet", description: "Guess song from snippet" },
  { value: "POLL", label: "Poll", description: "No correct answer, just opinions" },
  { value: "PHOTO_OPEN", label: "Photo Open", description: "Open answer with photo" },
  { value: "AUDIO_OPEN", label: "Audio Open", description: "Open answer with audio" },
  { value: "VIDEO_OPEN", label: "Video Open", description: "Open answer with video" },
];

export default function NewQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [selectedType, setSelectedType] = useState<QuestionType | null>(null);
  const [loading, setLoading] = useState(false);

  // Basic fields
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

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

  // Spotify/YouTube
  const [spotifyTrackId, setSpotifyTrackId] = useState<string>("");
  const [youtubeVideoId, setYoutubeVideoId] = useState<string>("");

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!selectedType || !title.trim()) {
      alert("Please select a question type and enter a title");
      return;
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
        case "OPEN_TEXT":
        case "PHOTO_OPEN":
        case "AUDIO_OPEN":
        case "VIDEO_OPEN":
          if (openTextAnswer.trim()) {
            questionOptions = [{ text: openTextAnswer, isCorrect: true, order: 0 }];
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
          options: questionOptions,
          spotifyTrackId: spotifyTrackId || undefined,
          youtubeVideoId: youtubeVideoId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create question");
      }

      const { question: createdQuestion } = await response.json();
      router.push(`/dashboard/workspaces/${workspaceId}/questions/${createdQuestion.id}/edit`);
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
          <p className="text-gray-600">Choose a question type to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUESTION_TYPES.map((type) => (
            <div key={type.value} onClick={() => setSelectedType(type.value)}>
              <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary-500">
                <h3 className="text-lg font-semibold mb-2">{type.label}</h3>
                <p className="text-sm text-gray-600">{type.description}</p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => setSelectedType(null)}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Change Question Type
        </button>
        <h1 className="text-3xl font-bold mb-2">
          {QUESTION_TYPES.find((t) => t.value === selectedType)?.label}
        </h1>
        <p className="text-gray-600">
          {QUESTION_TYPES.find((t) => t.value === selectedType)?.description}
        </p>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter question title..."
            className="w-full"
          />
        </Card>

        {/* Prompt */}
        <Card className="p-6">
          <label className="block text-sm font-semibold mb-2">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Additional context or instructions (optional)..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
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
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                ✅ True
              </button>
              <button
                onClick={() => setTrueFalseAnswer(false)}
                className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-colors ${
                  !trueFalseAnswer
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
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
                <label className="block text-sm text-gray-600 mb-2">Correct Answer</label>
                <Input
                  type="number"
                  value={estimationAnswer}
                  onChange={(e) => setEstimationAnswer(parseFloat(e.target.value))}
                  placeholder="e.g., 42"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Margin (%)</label>
                <Input
                  type="number"
                  value={estimationMargin}
                  onChange={(e) => setEstimationMargin(parseFloat(e.target.value))}
                  placeholder="e.g., 10"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
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
                  <span className="text-gray-500 font-mono w-8">{index + 1}.</span>
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
            <p className="text-sm text-gray-500 mt-2">
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
                  <span className="text-gray-400 text-2xl">📊</span>
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
              Expected Answer (optional - for host reference)
            </label>
            <textarea
              value={openTextAnswer}
              onChange={(e) => setOpenTextAnswer(e.target.value)}
              placeholder="Enter the expected answer or leave blank for fully open questions..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-sm text-gray-500 mt-2">
              Players will type their answer. Host reviews manually.
            </p>
          </Card>
        )}

        {/* Media placeholder for PHOTO/AUDIO/VIDEO types */}
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
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500 mb-2">
                📎 Media upload will be available after question is created
              </p>
              <p className="text-sm text-gray-400">
                You can attach {selectedType.startsWith("PHOTO") ? "images" : selectedType.startsWith("AUDIO") ? "audio" : "video"} files in the edit view
              </p>
            </div>
          </Card>
        )}

        {/* Spotify Integration for MUSIC types */}
        {(selectedType === "MUSIC_INTRO" || selectedType === "MUSIC_SNIPPET") && (
          <Card className="p-6">
            <label className="block text-sm font-semibold mb-4">Spotify Track</label>
            <div className="space-y-3">
              <Input
                value={spotifyTrackId}
                onChange={(e) => setSpotifyTrackId(e.target.value)}
                placeholder="Enter Spotify Track ID (e.g., 3n3Ppam7vgaVa1iaRUc9Lp)"
              />
              <p className="text-sm text-gray-500">
                You can find the Track ID in the Spotify share URL. Full Spotify integration coming soon!
              </p>
              {selectedType === "MUSIC_SNIPPET" && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Snippet Start Time (seconds)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g., 30"
                  />
                </div>
              )}
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </Card>

        {/* Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Settings</h3>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            <label className="block text-sm text-gray-600 mb-2">Tags</label>
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
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2"
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
