interface TimerProps {
  timeRemaining: number; // milliseconds
  totalDuration: number; // milliseconds
}

export function Timer({ timeRemaining, totalDuration }: TimerProps) {
  const percentage = (timeRemaining / totalDuration) * 100;
  const seconds = Math.ceil(timeRemaining / 1000);

  // Color based on time remaining
  const getColor = () => {
    if (percentage > 50) return "text-green-500";
    if (percentage > 20) return "text-yellow-500";
    return "text-red-500";
  };

  const getStrokeColor = () => {
    if (percentage > 50) return "#10b981"; // green-500
    if (percentage > 20) return "#eab308"; // yellow-500
    return "#ef4444"; // red-500
  };

  const radius = 22;
  const svgSize = 56;
  const center = svgSize / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-14 h-14 md:w-20 md:h-20">
      <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="5"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={getStrokeColor()}
          strokeWidth="5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-100"
        />
      </svg>
      {/* Time display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg md:text-2xl font-black ${getColor()}`}>
          {seconds}
        </span>
      </div>
    </div>
  );
}
