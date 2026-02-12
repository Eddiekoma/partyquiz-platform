import type { QuestionType } from "@partyquiz/shared";
import { YouTubePlayer } from "../YouTubePlayer";
import { QuestionTypeBadge } from "../QuestionTypeBadge";

interface QuestionDisplayProps {
  questionType: QuestionType;
  prompt: string;
  mediaUrl?: string;
  settingsJson?: any;
}

export function QuestionDisplay({
  questionType,
  prompt,
  mediaUrl,
  settingsJson,
}: QuestionDisplayProps) {
  return (
    <div className="w-full">
      {/* Question Type Badge */}
      <div className="flex justify-center mb-4">
        <QuestionTypeBadge type={questionType} size="md" />
      </div>

      {/* Media */}
      {mediaUrl && (
        <div className="mb-6">
          {renderMedia(questionType, mediaUrl, settingsJson)}
        </div>
      )}

      {/* Prompt */}
      <div className="bg-slate-800/10 backdrop-blur-sm rounded-3xl p-8 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
          {prompt}
        </h2>
      </div>
    </div>
  );
}

function renderMedia(
  questionType: QuestionType,
  mediaUrl: string,
  settingsJson?: any
) {
  // Photo question types (PHOTO_QUESTION, PHOTO_OPEN)
  if (
    questionType === "PHOTO_QUESTION" ||
    questionType === "PHOTO_OPEN"
  ) {
    return (
      <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-2xl overflow-hidden bg-black/20">
        <img
          src={mediaUrl}
          alt="Question"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Audio question types (AUDIO_QUESTION, AUDIO_OPEN) and Spotify music types
  if (
    questionType === "AUDIO_QUESTION" ||
    questionType === "AUDIO_OPEN" ||
    questionType === "MUSIC_GUESS_TITLE" ||
    questionType === "MUSIC_GUESS_ARTIST" ||
    questionType === "MUSIC_GUESS_YEAR"
  ) {
    return (
      <div className="max-w-2xl mx-auto">
        <audio
          src={mediaUrl}
          controls
          autoPlay
          className="w-full"
          style={{
            borderRadius: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
          }}
        />
      </div>
    );
  }

  // YouTube question types and Video question types
  if (
    questionType === "YOUTUBE_SCENE_QUESTION" ||
    questionType === "YOUTUBE_NEXT_LINE" ||
    questionType === "YOUTUBE_WHO_SAID_IT" ||
    questionType === "VIDEO_QUESTION" ||
    questionType === "VIDEO_OPEN"
  ) {
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) {
      return (
        <div className="text-white/60 text-center py-8">
          Invalid YouTube URL
        </div>
      );
    }

    const startTime = settingsJson?.startSeconds || settingsJson?.startTime || 0;
    const endTime = settingsJson?.endSeconds;

    return (
      <div className="w-full max-w-3xl mx-auto">
        <YouTubePlayer
          videoId={videoId}
          autoplay={true}
          startSeconds={startTime}
          endSeconds={endTime}
          onReady={() => console.log("[Player] YouTube player ready")}
          onEnd={() => console.log("[Player] YouTube video ended")}
        />
      </div>
    );
  }

  return null;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
