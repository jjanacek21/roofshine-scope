import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, DoorOpen, ThumbsDown, RotateCcw, ThumbsUp, Search, Calendar, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerInfoForm, type CustomerInfo } from "./CustomerInfoForm";
import { DOOR_POINTS, type DoorDisposition } from "@/hooks/useDoorToDoorSession";

interface DoorKnockPanelProps {
  onSubmit: (disposition: DoorDisposition, customerInfo?: CustomerInfo) => void;
  onClose: () => void;
  address?: string;
}

const dispositions: {
  value: DoorDisposition;
  label: string;
  icon: typeof DoorOpen;
  color: string;
  bgColor: string;
  points: number;
}[] = [
  { 
    value: 'not_home', 
    label: 'Not Home', 
    icon: DoorOpen, 
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.not_home
  },
  { 
    value: 'not_interested', 
    label: 'Not Interested', 
    icon: ThumbsDown, 
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.not_interested
  },
  { 
    value: 'go_back', 
    label: 'Go Back', 
    icon: RotateCcw, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.go_back
  },
  { 
    value: 'interested', 
    label: 'Interested', 
    icon: ThumbsUp, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.interested
  },
  { 
    value: 'needs_inspection', 
    label: 'Needs Inspection', 
    icon: Search, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.needs_inspection
  },
  { 
    value: 'appointment_set', 
    label: 'Appointment Set', 
    icon: Calendar, 
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.appointment_set
  },
  { 
    value: 'contract_signed', 
    label: 'Contract Signed', 
    icon: FileCheck, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    points: DOOR_POINTS.base_knock + DOOR_POINTS.contract_signed
  },
];

export function DoorKnockPanel({ onSubmit, onClose, address }: DoorKnockPanelProps) {
  const [selectedDisposition, setSelectedDisposition] = useState<DoorDisposition | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({});

  const handleSubmit = () => {
    if (!selectedDisposition) return;
    onSubmit(selectedDisposition, customerInfo);
  };

  const selectedConfig = dispositions.find(d => d.value === selectedDisposition);
  const showAppointmentField = selectedDisposition === 'appointment_set';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-background/95 backdrop-blur-lg rounded-t-3xl shadow-2xl border-t max-h-[80vh] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Record Door Knock</h3>
              {address && (
                <p className="text-sm text-muted-foreground truncate max-w-[250px]">{address}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Disposition Grid */}
          <div className="grid grid-cols-2 gap-2">
            {dispositions.map((d) => (
              <button
                key={d.value}
                onClick={() => setSelectedDisposition(d.value)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                  selectedDisposition === d.value
                    ? `border-primary ${d.bgColor}`
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", d.bgColor)}>
                  <d.icon className={cn("w-5 h-5", d.color)} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-primary font-semibold">+{d.points} pts</p>
                </div>
              </button>
            ))}
          </div>

          {/* Customer Info Form (expandable) */}
          {selectedDisposition && (
            <CustomerInfoForm
              onSubmit={setCustomerInfo}
              showAppointment={showAppointmentField}
            />
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedDisposition}
            className="w-full h-12 text-lg font-semibold"
          >
            {selectedConfig ? (
              <>
                Record: {selectedConfig.label} (+{selectedConfig.points + (customerInfo.name || customerInfo.phone || customerInfo.email ? DOOR_POINTS.customer_info : 0)} pts)
              </>
            ) : (
              'Select a disposition'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

