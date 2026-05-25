import { cn } from "@/lib/utils";
import { PITCH_OPTIONS, PitchBucket, ServiceType } from "@/lib/roofMeasurements";

interface PitchSelectorProps {
  value: PitchBucket;
  onChange: (pitch: PitchBucket) => void;
  serviceType: ServiceType;
}

export function PitchSelector({ value, onChange, serviceType }: PitchSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Select Roof Pitch</p>
      <div className="grid grid-cols-5 gap-2">
        {PITCH_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id as PitchBucket)}
            className={cn(
              "flex flex-col items-center p-2 rounded-lg border-2 transition-all hover:border-primary/50",
              value === option.id
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-muted bg-background hover:bg-muted/50"
            )}
          >
            <img
              src={option.image}
              alt={option.label}
              className="w-full h-12 object-contain mb-1"
            />
            <span className="text-[10px] font-medium text-center leading-tight">
              {option.id === 'flat' && 'Flat'}
              {option.id === 'low' && 'Low'}
              {option.id === 'standard' && 'Standard'}
              {option.id === 'steep' && 'Steep'}
              {option.id === 'verysteep' && 'Very Steep'}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {serviceType === 'coating' 
          ? 'Coatings are typically applied to flat or low-slope roofs' 
          : 'Select the approximate pitch of your roof'}
      </p>
    </div>
  );
}
