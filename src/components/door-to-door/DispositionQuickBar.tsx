import { 
  Home, 
  X, 
  RotateCcw, 
  ThumbsUp, 
  Search, 
  Calendar, 
  FileCheck,
  Circle,
  CloudLightning,
  Slash,
  Users,
  CheckCircle,
  Clock,
  Hourglass,
  Sun,
  Zap,
  Building2,
  ClipboardCheck,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDisposition } from '@/hooks/usePropertyDispositions';

interface DispositionQuickBarProps {
  currentDisposition: PropertyDisposition;
  onSelect: (disposition: PropertyDisposition) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const DISPOSITIONS: {
  value: PropertyDisposition;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  hexColor: string;
  points: number;
}[] = [
  { 
    value: 'go_back', 
    label: 'Go Back', 
    shortLabel: 'Go Back',
    icon: RotateCcw, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-100 hover:bg-amber-200',
    hexColor: '#d97706',
    points: 3,
  },
  { 
    value: 'not_home', 
    label: 'Not Home', 
    shortLabel: 'Not Home',
    icon: Home, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100 hover:bg-gray-200',
    hexColor: '#64748b',
    points: 2,
  },
  { 
    value: 'not_interested', 
    label: 'Not Interested', 
    shortLabel: 'Not Int.',
    icon: X, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100 hover:bg-red-200',
    hexColor: '#dc2626',
    points: 0,
  },
  { 
    value: 'interested', 
    label: 'Interested', 
    shortLabel: 'Interested',
    icon: ThumbsUp, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100 hover:bg-blue-200',
    hexColor: '#2563eb',
    points: 10,
  },
  { 
    value: 'need_inspection', 
    label: 'Need Inspection', 
    shortLabel: 'Inspect',
    icon: Search, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100 hover:bg-orange-200',
    hexColor: '#ea580c',
    points: 75,
  },
  { 
    value: 'storm_damage', 
    label: 'Storm Damage', 
    shortLabel: 'Storm',
    icon: CloudLightning, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100 hover:bg-purple-200',
    hexColor: '#9333ea',
    points: 15,
  },
  { 
    value: 'unqualified', 
    label: 'Unqualified', 
    shortLabel: 'Unqual.',
    icon: Slash, 
    color: 'text-slate-500', 
    bgColor: 'bg-slate-100 hover:bg-slate-200',
    hexColor: '#94a3b8',
    points: 0,
  },
  { 
    value: 'canvass_lead', 
    label: 'Canvass Lead', 
    shortLabel: 'Lead',
    icon: Users, 
    color: 'text-teal-600', 
    bgColor: 'bg-teal-100 hover:bg-teal-200',
    hexColor: '#14b8a6',
    points: 25,
  },
  { 
    value: 'new_roof', 
    label: 'New Roof', 
    shortLabel: 'New Roof',
    icon: CheckCircle, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100 hover:bg-green-200',
    hexColor: '#22c55e',
    points: 50,
  },
  { 
    value: 'follow_up', 
    label: 'Follow Up', 
    shortLabel: 'Follow Up',
    icon: Clock, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-100 hover:bg-yellow-200',
    hexColor: '#eab308',
    points: 5,
  },
  { 
    value: 'waiting', 
    label: 'Waiting', 
    shortLabel: 'Waiting',
    icon: Hourglass, 
    color: 'text-cyan-600', 
    bgColor: 'bg-cyan-100 hover:bg-cyan-200',
    hexColor: '#06b6d4',
    points: 5,
  },
  { 
    value: 'already_solar', 
    label: 'Already Solar', 
    shortLabel: 'Solar',
    icon: Sun, 
    color: 'text-lime-600', 
    bgColor: 'bg-lime-100 hover:bg-lime-200',
    hexColor: '#84cc16',
    points: 0,
  },
  { 
    value: 'opportunity', 
    label: 'Opportunity', 
    shortLabel: 'Oppty',
    icon: Zap, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-100 hover:bg-indigo-200',
    hexColor: '#6366f1',
    points: 30,
  },
  { 
    value: 'commercial', 
    label: 'Commercial', 
    shortLabel: 'Comm.',
    icon: Building2, 
    color: 'text-slate-600', 
    bgColor: 'bg-slate-100 hover:bg-slate-200',
    hexColor: '#475569',
    points: 10,
  },
  { 
    value: 'inspected', 
    label: 'Inspected', 
    shortLabel: 'Inspected',
    icon: ClipboardCheck, 
    color: 'text-emerald-600', 
    bgColor: 'bg-emerald-100 hover:bg-emerald-200',
    hexColor: '#10b981',
    points: 100,
  },
  { 
    value: 'old_roof', 
    label: 'Old Roof', 
    shortLabel: 'Old Roof',
    icon: Home, 
    color: 'text-amber-800', 
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    hexColor: '#92400e',
    points: 10,
  },
  { 
    value: 'won', 
    label: 'Won', 
    shortLabel: 'Won!',
    icon: Trophy, 
    color: 'text-yellow-500', 
    bgColor: 'bg-yellow-50 hover:bg-yellow-100',
    hexColor: '#fbbf24',
    points: 200,
  },
];

export function DispositionQuickBar({ 
  currentDisposition, 
  onSelect, 
  disabled,
  compact = false
}: DispositionQuickBarProps) {
  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {DISPOSITIONS.map((disp) => {
          const Icon = disp.icon;
          const isSelected = currentDisposition === disp.value;
          
          return (
            <button
              key={disp.value}
              onClick={() => onSelect(disp.value)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                disp.bgColor,
                isSelected && "ring-2 ring-offset-1 ring-primary scale-105",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn("w-4 h-4", disp.color)} />
              <span className={cn("text-[10px] font-medium leading-tight text-center", disp.color)}>
                {disp.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-2 min-w-max px-1">
        {DISPOSITIONS.map((disp) => {
          const Icon = disp.icon;
          const isSelected = currentDisposition === disp.value;
          
          return (
            <button
              key={disp.value}
              onClick={() => onSelect(disp.value)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl transition-all min-w-[72px]",
                disp.bgColor,
                isSelected && "ring-2 ring-offset-1 ring-primary scale-105",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isSelected ? "bg-white shadow-sm" : "bg-white/50"
              )}>
                <Icon className={cn("w-5 h-5", disp.color)} />
              </div>
              <span className={cn("text-xs font-medium", disp.color)}>
                {disp.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Export disposition config for use in other components
export const DISPOSITION_CONFIG = DISPOSITIONS;

// Helper to get color for a disposition
export function getDispositionColor(disposition: PropertyDisposition): string {
  const found = DISPOSITIONS.find(d => d.value === disposition);
  if (found) return found.hexColor;
  
  // Legacy fallback
  switch (disposition) {
    case 'not_contacted': return '#f59e0b';
    case 'needs_inspection': return '#ea580c';
    case 'appointment_set': return '#16a34a';
    case 'contract_signed': return '#eab308';
    default: return '#f59e0b';
  }
}

// Helper to check if disposition should be filled
export function isDispositionFilled(disposition: PropertyDisposition): boolean {
  return disposition !== 'not_contacted';
}

// Helper to get disposition by value
export function getDispositionConfig(disposition: PropertyDisposition) {
  return DISPOSITIONS.find(d => d.value === disposition);
}

