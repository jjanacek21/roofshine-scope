import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudLightning } from "lucide-react";
import { toast } from "sonner";
import { StormSwathMap } from "@/components/storm/StormSwathMap";
import { stormSupabase } from "@/integrations/storm/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/storm-intelligence")({
  head: () => ({
    meta: [
      { title: "Storm Intelligence" },
      {
        name: "description",
        content:
          "Nationwide live hail swaths, wind gust reports, and severe thunderstorm warnings.",
      },
    ],
  }),
  component: StormIntelligencePage,
});

const JUMPS = {
  usa: { label: "USA", center: [-96.5, 38.5] as [number, number], zoom: 4 },
  dfw: { label: "DFW", center: [-96.8, 32.78] as [number, number], zoom: 9 },
  sfl: { label: "South Florida", center: [-80.35, 26.1] as [number, number], zoom: 9 },
};

const WIND_OPTIONS: { label: string; hours: number }[] = [
  { label: "Last 24h", hours: 24 },
  { label: "Last 72h", hours: 72 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
  { label: "Last 6 months", hours: 4380 },
  { label: "Last 2 years", hours: 17520 },
];

function StormIntelligencePage() {
  const [view, setView] = useState<keyof typeof JUMPS>("usa");
  const [windHours, setWindHours] = useState<number>(72);
  const [eventDate, setEventDate] = useState<string | null>(null);

  const { data: dates = [] } = useQuery({
    queryKey: ["storm-swath-dates"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("swath_dates" as any);
      if (error) {
        toast.error(`swath_dates: ${error.message}`);
        throw error;
      }
      const rows = (data ?? []) as any[];
      const list = rows
        .map((r) => (typeof r === "string" ? r : r?.event_date ?? r?.date))
        .filter(Boolean) as string[];
      return list.sort().reverse();
    },
  });

  const activeDate = useMemo(() => eventDate ?? dates[0] ?? null, [eventDate, dates]);
  const v = JUMPS[view];

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CloudLightning className="h-4 w-4" style={{ color: "var(--brand)" }} />
          Storm Intelligence
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-[11px] uppercase" style={{ color: "var(--text-muted)", letterSpacing: "1px" }}>
            Event date
          </label>
          <Select
            value={activeDate ?? "__none"}
            onValueChange={(v) => setEventDate(v === "__none" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="No dates" />
            </SelectTrigger>
            <SelectContent>
              {dates.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No hail data yet
                </SelectItem>
              ) : (
                dates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <label className="text-[11px] uppercase" style={{ color: "var(--text-muted)", letterSpacing: "1px" }}>
            Wind
          </label>
          <Select value={String(windHours)} onValueChange={(v) => setWindHours(Number(v))}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIND_OPTIONS.map((o) => (
                <SelectItem key={o.hours} value={String(o.hours)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="flex items-center gap-1 rounded-lg border p-1"
            style={{ borderColor: "var(--border)" }}
          >
            {Object.entries(JUMPS).map(([k, j]) => (
              <Button
                key={k}
                size="sm"
                variant={view === k ? "default" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setView(k as keyof typeof JUMPS)}
              >
                {j.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <StormSwathMap
          eventDate={activeDate}
          windHours={windHours}
          center={v.center}
          zoom={v.zoom}
        />
      </div>
    </div>
  );
}
