import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudLightning } from "lucide-react";
import { StormSwathMap } from "@/components/storm/StormSwathMap";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_app/storm-intelligence")({
  head: () => ({
    meta: [
      { title: "Storm Intelligence" },
      {
        name: "description",
        content:
          "Live hail swaths and wind gust reports mapped across your service territories.",
      },
    ],
  }),
  component: StormIntelligencePage,
});

const MARKETS = {
  dfw: { label: "DFW", center: [-96.8, 32.78] as [number, number], zoom: 9 },
  sfl: { label: "South Florida", center: [-80.35, 26.1] as [number, number], zoom: 9 },
};

function StormIntelligencePage() {
  const [market, setMarket] = useState<keyof typeof MARKETS>("dfw");
  const [windHours, setWindHours] = useState<number>(72);
  const [eventDate, setEventDate] = useState<string | null>(null);

  const { data: dates = [] } = useQuery({
    queryKey: ["storm-swath-dates"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("swath_dates" as any);
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
  const m = MARKETS[market];

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
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Last 24h</SelectItem>
              <SelectItem value="48">Last 48h</SelectItem>
              <SelectItem value="72">Last 72h</SelectItem>
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            value={market}
            onValueChange={(v) => v && setMarket(v as keyof typeof MARKETS)}
            className="rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            {Object.entries(MARKETS).map(([k, v]) => (
              <ToggleGroupItem key={k} value={k} className="h-8 px-3 text-xs">
                {v.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="relative flex-1">
        <StormSwathMap
          eventDate={activeDate}
          windHours={windHours}
          center={m.center}
          zoom={m.zoom}
        />
      </div>
    </div>
  );
}
