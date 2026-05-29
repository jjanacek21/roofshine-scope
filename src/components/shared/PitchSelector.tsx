import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { PITCH_OPTIONS, PitchBucket, ServiceType } from "@/lib/roofMeasurements";

interface PitchSelectorProps {
  value: PitchBucket;
  onChange: (pitch: PitchBucket) => void;
  serviceType: ServiceType;
}

// Short labels for lean cards
const SHORT_LABEL: Record<string, { name: string; pitch: string }> = {
  flat: { name: "Flat", pitch: "0–2/12" },
  low: { name: "Low", pitch: "3–4/12" },
  standard: { name: "Standard", pitch: "5–6/12" },
  steep: { name: "Steep", pitch: "7–8/12" },
  verysteep: { name: "Very Steep", pitch: "9–12/12" },
};

export function PitchSelector({ value, onChange, serviceType }: PitchSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Select Roof Pitch
      </p>

      <div className="grid grid-cols-5 gap-2.5 [perspective:1000px]">
        {PITCH_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          const meta = SHORT_LABEL[option.id] ?? { name: option.label, pitch: "" };

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id as PitchBucket)}
              className={cn(
                "group relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-3",
                "border transition-all duration-300 ease-out will-change-transform",
                "[transform-style:preserve-3d]",
                isSelected
                  ? "border-primary/70 bg-gradient-to-b from-primary/15 to-primary/5 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.45),inset_0_1px_0_0_hsl(var(--primary)/0.35)] -translate-y-0.5"
                  : "border-border bg-gradient-to-b from-card to-card/40 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.04)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_14px_30px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:[transform:translateY(-4px)_rotateX(4deg)]"
              )}
            >
              {/* Selected check */}
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}

              {/* Pitch illustration tile */}
              <div
                className={cn(
                  "relative flex h-12 w-full items-center justify-center rounded-lg overflow-hidden",
                  "bg-gradient-to-br from-background/60 to-background/20",
                  "ring-1 ring-inset ring-white/5",
                  "transition-transform duration-300 group-hover:scale-105"
                )}
              >
                <img
                  src={option.image}
                  alt={meta.name}
                  className="h-9 w-9 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                />
                {/* subtle gloss */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/8 to-transparent" />
              </div>

              {/* Label */}
              <div className="flex flex-col items-center leading-tight">
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-tight",
                    isSelected ? "text-primary" : "text-foreground"
                  )}
                >
                  {meta.name}
                </span>
                {meta.pitch && (
                  <span className="font-mono-num text-[9px] tabular-nums text-muted-foreground">
                    {meta.pitch}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {serviceType === "coating"
          ? "Coatings are typically applied to flat or low-slope roofs"
          : "Pick the closest match to your roof's angle"}
      </p>
    </div>
  );
}
