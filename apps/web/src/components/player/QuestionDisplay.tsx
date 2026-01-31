import type { QuestionType } from "@partyquiz/shared";

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
      {/* Media */}
      {mediaUrl && (
        <div className="mb-6">
          {renderMedia(questionType, mediaUrl, settingsJson)}
        </div>
      )}

      {/* Prompt */}
      <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center">
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
  // Photo question types
  if (
    questionType === "PHOTO_GUESS" ||
    questionType === "PHOTO_ZOOM_REVEAL" ||
    questionType === "PHOTO_TIMELINE"
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

  // Music question types
  if (
    questionType === "MUSIC_GUESS_TITLE" ||
    questionType === "MUSIC_GUESS_ARTIST" ||
    questionType === "MUSIC_GUESS_YEAR" ||
    questionType === "MUSIC_HITSTER_TIMELINE" ||
    questionType === "MUSIC_OLDER_NEWER_THAN"
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

  // YouTube question types
  if (
    questionType === "YOUTUBE_SCENE_QUESTION" ||
    questionType === "YOUTUBE_NEXT_LINE" ||
    questionType === "YOUTUBE_WHO_SAID_IT"
  ) {
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) {
      return (
        <div className="text-white/60 text-center py-8">
          Invalid YouTube URL
        </div>
      );
    }

    const startTime = settingsJson?.startTime || 0;

    return (
      <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-2xl overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?start=${startTime}&autoplay=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
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
