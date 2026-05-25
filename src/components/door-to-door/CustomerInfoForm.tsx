import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, User, Phone, Mail, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerInfoFormProps {
  onSubmit: (info: CustomerInfo) => void;
  showAppointment?: boolean;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  appointmentDate?: string;
  notes?: string;
}

export function CustomerInfoForm({ onSubmit, showAppointment }: CustomerInfoFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [info, setInfo] = useState<CustomerInfo>({});

  const handleSubmit = () => {
    onSubmit(info);
  };

  const hasAnyInfo = info.name || info.phone || info.email;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Add Customer Info {hasAnyInfo && <span className="text-primary">(+20 pts)</span>}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <div
        className={cn(
          "space-y-4 overflow-hidden transition-all duration-300",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm flex items-center gap-2">
            <User className="w-3 h-3" /> Name
          </Label>
          <Input
            id="name"
            placeholder="Customer name"
            value={info.name || ""}
            onChange={(e) => setInfo(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm flex items-center gap-2">
            <Phone className="w-3 h-3" /> Phone
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={info.phone || ""}
            onChange={(e) => setInfo(prev => ({ ...prev, phone: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm flex items-center gap-2">
            <Mail className="w-3 h-3" /> Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="customer@email.com"
            value={info.email || ""}
            onChange={(e) => setInfo(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>

        {showAppointment && (
          <div className="space-y-2">
            <Label htmlFor="appointment" className="text-sm flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Appointment Date
            </Label>
            <Input
              id="appointment"
              type="datetime-local"
              value={info.appointmentDate || ""}
              onChange={(e) => setInfo(prev => ({ ...prev, appointmentDate: e.target.value }))}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Additional notes..."
            rows={2}
            value={info.notes || ""}
            onChange={(e) => setInfo(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}

