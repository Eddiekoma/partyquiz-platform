interface ScoreDisplayProps {
  score: number;
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  // Ensure score is a valid number
  const displayScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  
  return (
    <div className="bg-slate-800/20 backdrop-blur-sm px-4 py-2 rounded-full">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <span className="text-xl font-black text-white">{displayScore}</span>
      </div>
    </div>
  );
}
