import { Button } from "@/components/ui/button";
import { Play, Square, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onKnockDoor: () => void;
  isLoading?: boolean;
  canKnock?: boolean;
}

export function SessionControls({
  isActive,
  onStart,
  onStop,
  onKnockDoor,
  isLoading,
  canKnock = true
}: SessionControlsProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
      {/* Main Start/Stop Button */}
      <Button
        size="lg"
        onClick={isActive ? onStop : onStart}
        disabled={isLoading}
        className={cn(
          "h-14 px-8 rounded-full shadow-lg font-semibold text-lg transition-all",
          isActive 
            ? "bg-red-600 hover:bg-red-700 text-white" 
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
      >
        {isActive ? (
          <>
            <Square className="w-5 h-5 mr-2 fill-current" />
            End Session
          </>
        ) : (
          <>
            <Play className="w-5 h-5 mr-2 fill-current" />
            Start Session
          </>
        )}
      </Button>

      {/* Knock Door Button (only visible during active session) */}
      {isActive && canKnock && (
        <Button
          size="lg"
          onClick={onKnockDoor}
          className="h-14 px-8 rounded-full shadow-lg font-semibold text-lg bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
        >
          <MapPin className="w-5 h-5 mr-2" />
          Knock Door
        </Button>
      )}
    </div>
  );
}

