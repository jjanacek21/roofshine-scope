import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, MapPin, Loader2, RotateCcw, Save, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useLeads } from "@/hooks/useLeads";
import { fmtNum } from "@/lib/leads";
import { getRoofMeasurements, analyzeRoofWithAI } from "@/server/lead-ai.functions";
import { geocodeLead } from "@/server/leads.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/leads/wizard")({
  component: AIRoofWizard,
});

interface Pin {
  id: string;
  lat: number;
  lng: number;
}

interface Measurements {
  total_sqft: number;
  sun_hours_per_year: number;
  avg_pitch: number;
  segments: { pitch: number; azimuth: number; area_sqft: number }[];
}

function AIRoofWizard() {
  const { data: token } = useMapboxToken();
  const { data: leads = [] } = useLeads();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | "">("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisImage, setAnalysisImage] = useState<string>("");
  const [loading, setLoading] = useState<"none" | "measure" | "analyze">("none");
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const getMeasurements = useServerFn(getRoofMeasurements);
  const analyze = useServerFn(analyzeRoofWithAI);
  const geocode = useServerFn(geocodeLead);
  const qc = useQueryClient();

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [-80.25, 25.85],
      zoom: 17,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("click", (e) => {
      setPins((prev) => [
        ...prev,
        { id: crypto.randomUUID(), lat: e.lngLat.lat, lng: e.lngLat.lng },
      ]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Fly to selected lead — geocode on demand if coords are missing
  useEffect(() => {
    if (!selectedLead) {
      setResolvedCoords(null);
      return;
    }
    setPins([]);
    setMeasurements(null);
    setAnalysis("");
    setAnalysisImage("");

    const flyHere = (lat: number, lng: number) => {
      setResolvedCoords({ lat, lng });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 19 });
    };

    if (selectedLead.lat != null && selectedLead.lng != null) {
      flyHere(selectedLead.lat, selectedLead.lng);
      return;
    }

    // No coords — geocode
    const leadIdAtStart = selectedLead.id;
    setResolvedCoords(null);
    setLocating(true);
    geocode({ data: { leadId: selectedLead.id } })
      .then((res) => {
        if (leadIdAtStart !== selectedLeadId) return; // user moved on
        if (res.lat != null && res.lng != null) {
          flyHere(res.lat, res.lng);
          qc.invalidateQueries({ queryKey: ["leads"] });
        } else {
          toast.error(res.error ?? "Couldn't locate this address — drop pins manually.");
        }
      })
      .catch((e) => {
        if (leadIdAtStart !== selectedLeadId) return;
        toast.error(e instanceof Error ? e.message : "Geocoding failed");
      })
      .finally(() => {
        if (leadIdAtStart === selectedLeadId) setLocating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  // Render pin markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    pins.forEach((p, i) => {
      const el = document.createElement("div");
      el.style.cssText = `width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:#3b82f6;box-shadow:0 2px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font:600 11px system-ui;`;
      el.textContent = String(i + 1);
      const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(mapRef.current!);
      markersRef.current.push(m);
    });
  }, [pins]);

  const center = useMemo(() => {
    if (pins.length > 0) {
      return {
        lat: pins.reduce((a, p) => a + p.lat, 0) / pins.length,
        lng: pins.reduce((a, p) => a + p.lng, 0) / pins.length,
      };
    }
    if (selectedLead?.lat != null && selectedLead?.lng != null) {
      return { lat: selectedLead.lat, lng: selectedLead.lng };
    }
    if (resolvedCoords) return resolvedCoords;
    return null;
  }, [pins, selectedLead, resolvedCoords]);

  async function runMeasurements() {
    if (!center) {
      toast.error("Drop at least one pin or select a lead first.");
      return;
    }
    setLoading("measure");
    try {
      const res = await getMeasurements({ data: { lat: center.lat, lng: center.lng } });
      if (!res.ok) {
        toast.error(res.error);
        setMeasurements(null);
      } else {
        setMeasurements(res);
        toast.success("Measurements ready");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to measure");
    } finally {
      setLoading("none");
    }
  }

  async function runAnalysis() {
    if (!center) {
      toast.error("Drop at least one pin or select a lead first.");
      return;
    }
    setLoading("analyze");
    try {
      const res = await analyze({
        data: {
          lat: center.lat,
          lng: center.lng,
          address: selectedLead?.address ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
          pinCount: Math.max(1, pins.length),
          leadId: selectedLeadId || undefined,
        },
      });
      setAnalysis(res.analysis);
      setAnalysisImage(res.image_url);
      toast.success("AI analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyze");
    } finally {
      setLoading("none");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <Sparkles className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">AI Roof Wizard</h2>
          <p className="text-sm text-[var(--text-dim)]">
            Pick a lead, click the satellite to drop pins on the roof, then run measurements + AI analysis.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Lead
            </label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="flex w-full items-center justify-between rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-left text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className={cn("truncate", !selectedLead && "text-[var(--text-dim)]")}>
                    {selectedLead
                      ? selectedLead.address
                      : "Search by address or owner…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    if (!search) return 1;
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Search by address or owner…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No leads found.</CommandEmpty>
                    <CommandGroup>
                      {leads.map((l) => {
                        const hasCoords = l.lat != null && l.lng != null;
                        const haystack = `${l.address ?? ""} ${l.owner ?? ""} ${l.reported_owner ?? ""} ${l.city ?? ""}`.trim();
                        return (
                          <CommandItem
                            key={l.id}
                            value={`${haystack} ${l.id}`}
                            onSelect={() => {
                              setSelectedLeadId(l.id);
                              setPickerOpen(false);
                            }}
                            className="flex items-start gap-2"
                          >
                            <Check
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0",
                                selectedLeadId === l.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm">{l.address}</div>
                              <div className="truncate text-xs text-[var(--text-dim)]">
                                {(l.owner ?? l.reported_owner ?? "Unknown owner")}
                                {l.city ? ` · ${l.city}, ${l.state ?? ""}` : ""}
                                {!hasCoords ? " · no coords" : ""}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedLead && (
              <div className="mt-2 text-xs text-[var(--text-dim)]">
                {selectedLead.city}, {selectedLead.state} · {fmtNum(selectedLead.sqft)} sq ft on file
              </div>
            )}
            {locating && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Locating address…
              </div>
            )}
          </div>

          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Pins ({pins.length})
              </p>
              {pins.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPins([])}
                  className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {pins.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                <MapPin className="h-3.5 w-3.5" />
                Click the satellite to drop pins.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {pins.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between text-foreground">
                    <span className="font-mono-num">
                      {i + 1}. {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPins((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-[var(--text-dim)] hover:text-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={runMeasurements}
              disabled={loading !== "none" || !center}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
            >
              {loading === "measure" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Get measurements
            </button>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading !== "none" || !center}
              className="btn-brand flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-40"
            >
              {loading === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run AI analysis
            </button>
            {selectedLeadId && analysis && (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <Save className="h-3 w-3" /> Saved to lead automatically.
              </p>
            )}
          </div>
        </aside>

        <div className="space-y-3">
          <div
            ref={containerRef}
            className="h-[460px] w-full overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          />

          {measurements && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Google Solar — Building Insights
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total roof" value={`${fmtNum(Math.round(measurements.total_sqft))} sqft`} />
                <Stat label="Sun hours / yr" value={fmtNum(Math.round(measurements.sun_hours_per_year))} />
                <Stat label="Avg pitch" value={`${measurements.avg_pitch.toFixed(1)}°`} />
                <Stat label="Segments" value={fmtNum(measurements.segments.length)} />
              </div>
            </div>
          )}

          {analysis && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Claude vision report
              </p>
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                {analysisImage && (
                  <img
                    src={analysisImage}
                    alt="Roof satellite"
                    className="h-auto w-full rounded-lg border"
                    style={{ borderColor: "var(--border)" }}
                  />
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{analysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="mt-0.5 font-mono-num text-base font-bold text-foreground">{value}</div>
    </div>
  );
}
