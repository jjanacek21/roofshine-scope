import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, Trophy, Clock, Target, CloudLightning, MapPin, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { FieldSession, DoorToDooorStats } from "@/hooks/useDoorToDoorSession";

interface StormEvent {
  id: string;
  name: string;
  storm_date: string;
  affected_area: string;
  severity: string;
}

interface SessionStatsProps {
  session: FieldSession | null;
  allTimeStats: DoorToDooorStats | null;
  sessionStartTime?: Date;
  selectedStormId?: string | null;
  onStormChange?: (stormId: string | null) => void;
}

export function SessionStats({ session, allTimeStats, sessionStartTime, selectedStormId, onStormChange }: SessionStatsProps) {
  const [liveDuration, setLiveDuration] = useState("00:00");

  const { data: storms = [] } = useQuery({
    queryKey: ["storm-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storm_events")
        .select("*")
        .eq("is_active", true)
        .order("storm_date", { ascending: false });
      if (error) throw error;
      return data as StormEvent[];
    },
  });

  const selectedStorm = storms.find(s => s.id === selectedStormId);

  // Real-time duration timer
  useEffect(() => {
    if (!sessionStartTime) {
      setLiveDuration("00:00");
      return;
    }

    const calculateDuration = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    setLiveDuration(calculateDuration());
    const interval = setInterval(() => {
      setLiveDuration(calculateDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  return (
    <div className="fixed top-20 left-4 z-40 space-y-2 max-w-[280px]">
      {/* Storm Event Selector */}
      <Card className="bg-background/95 backdrop-blur shadow-lg border-primary/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CloudLightning className="w-4 h-4 text-amber-500" />
            <span>Storm Event</span>
          </div>
          <Select
            value={selectedStormId || "_none"}
            onValueChange={(v) => onStormChange?.(v === "_none" ? null : v)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select storm..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No storm selected</SelectItem>
              {storms.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <CloudLightning className={`w-3 h-3 ${s.severity === 'severe' ? 'text-destructive' : 'text-amber-500'}`} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected storm details */}
          {selectedStorm && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3 h-3" />
                <span>{format(new Date(selectedStorm.storm_date + 'T00:00:00'), "MMM d, yyyy")}</span>
                <Badge 
                  variant="outline" 
                  className={`text-[9px] px-1.5 py-0 ml-auto ${
                    selectedStorm.severity === 'severe' 
                      ? 'border-destructive/40 text-destructive' 
                      : 'border-amber-500/40 text-amber-600'
                  }`}
                >
                  {selectedStorm.severity}
                </Badge>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{selectedStorm.affected_area}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Session Stats */}
      {session && (
        <Card className="bg-background/95 backdrop-blur shadow-lg border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Current Session</span>
              <Badge variant="default" className="bg-green-600 animate-pulse">
                LIVE
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DoorOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{session.total_doors}</p>
                  <p className="text-xs text-muted-foreground">Doors</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{session.total_points}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{liveDuration}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All-Time Stats (collapsed view) */}
      {allTimeStats && (
        <Card className="bg-background/90 backdrop-blur shadow-md">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 text-sm">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">All-time:</span>
              <span className="font-semibold">{allTimeStats.total_doors} doors</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-amber-500">{allTimeStats.total_points} pts</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
