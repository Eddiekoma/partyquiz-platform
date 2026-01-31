interface ScoreDisplayProps {
  score: number;
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <span className="text-xl font-black text-white">{score}</span>
      </div>
    </div>
  );
}
