import type { QuestionType } from "@partyquiz/shared";
import { requiresPhotos } from "@partyquiz/shared";
import { YouTubePlayer } from "../YouTubePlayer";
import { QuestionTypeBadge } from "../QuestionTypeBadge";
import { PhotoGrid } from "../PhotoGrid";

interface QuestionMedia {
  id: string;
  url: string;
  type: string;
  width?: number | null;
  height?: number | null;
  displayOrder: number;
}

interface QuestionDisplayProps {
  questionType: QuestionType;
  prompt: string;
  mediaUrl?: string;
  media?: QuestionMedia[];
  settingsJson?: any;
}

export function QuestionDisplay({
  questionType,
  prompt,
  mediaUrl,
  media,
  settingsJson,
}: QuestionDisplayProps) {
  return (
    <div className="w-full">
      {/* Question Type Badge - hidden on mobile to save space */}
      <div className="hidden md:flex justify-center mb-4">
        <QuestionTypeBadge type={questionType} size="md" />
      </div>

      {/* Photo Grid for PHOTO_ types */}
      {requiresPhotos(questionType) && media && media.length > 0 && (
        <div className="mb-4 md:mb-6">
          <PhotoGrid photos={media} />
        </div>
      )}

      {/* Legacy single mediaUrl (for AUDIO_, VIDEO_, YOUTUBE_) */}
      {mediaUrl && !requiresPhotos(questionType) && (
        <div className="mb-4 md:mb-6">
          {renderMedia(questionType, mediaUrl, settingsJson)}
        </div>
      )}

      {/* Prompt */}
      <div className="bg-slate-800/10 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-8 text-center">
        <h2 className="text-xl md:text-3xl lg:text-4xl font-black text-white leading-tight">
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
  // Spotify music question types - show listening indicator (audio plays on display screen)
  if (
    questionType === "MUSIC_GUESS_TITLE" ||
    questionType === "MUSIC_GUESS_ARTIST" ||
    questionType === "MUSIC_GUESS_YEAR"
  ) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        {/* Animated equalizer bars */}
        <div className="flex items-end justify-center gap-1.5 mb-3 h-12">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-2 bg-gradient-to-t from-green-500 to-green-300 rounded-full"
              style={{
                animation: `playerEqualizer 0.7s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.09}s`,
                height: "10px",
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes playerEqualizer {
            0% { height: 6px; }
            100% { height: 40px; }
          }
        `}</style>
        <p className="text-lg font-bold text-white mb-1">🎧 Listen to the screen!</p>
        <p className="text-sm text-white/50">
          {questionType === "MUSIC_GUESS_TITLE" ? "Guess the song title" :
           questionType === "MUSIC_GUESS_ARTIST" ? "Guess the artist" :
           "Guess the release year"}
        </p>
      </div>
    );
  }

  // Audio question types (AUDIO_QUESTION, AUDIO_OPEN)
  if (
    questionType === "AUDIO_QUESTION" ||
    questionType === "AUDIO_OPEN"
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
