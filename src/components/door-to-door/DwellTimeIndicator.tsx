import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";

interface DwellTimeIndicatorProps {
  requiredSeconds: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function DwellTimeIndicator({
  requiredSeconds,
  onComplete,
  onCancel
}: DwellTimeIndicatorProps) {
  const [remaining, setRemaining] = useState(requiredSeconds);
  const hasCompletedRef = useRef(false);
  const progress = Math.min(((requiredSeconds - remaining) / requiredSeconds) * 100, 100);

  useEffect(() => {
    // Reset completion flag when component mounts
    hasCompletedRef.current = false;
    setRemaining(requiredSeconds);

    const interval = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          clearInterval(interval);
          // Use setTimeout to avoid state update during render
          setTimeout(() => onComplete(), 0);
          return 0;
        }
        return Math.max(next, 0);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [requiredSeconds, onComplete]);

  const elapsed = requiredSeconds - remaining;
  const circumference = 2 * Math.PI * 44; // r=44

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
        <div className="w-24 h-24 mx-auto relative">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted/20"
            />
            {/* Progress circle - animates smoothly */}
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              className="text-primary transition-all duration-1000 ease-linear"
            />
          </svg>
          {/* Countdown number in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary tabular-nums">
              {remaining}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Dwell Time Verification</h3>
          <p className="text-muted-foreground text-sm">
            Please wait at the door for {requiredSeconds} seconds to verify your knock
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{elapsed}s / {requiredSeconds}s</span>
        </div>

        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
